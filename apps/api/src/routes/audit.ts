import "../types.js";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../lib/db/index.js";
import { auditRuns, auditIssues, projects } from "@garage-seo/db";
import { createId } from "@garage-seo/db";
import {
  runAuditRules,
  extractPageSpeed,
  checkWwwResolve,
  type AuditIssue,
  type CrawlResult,
} from "../lib/audit-rules.js";
import type { CrawledPageSummary, AiCrawlerAccess, RawMetricsJson, PageSpeedEntry } from "@garage-seo/db";
import { PageSpeedClient } from "@garage-seo/google-apis";
import { clickhouse } from "../lib/clickhouse/index.js";

const router = new Hono();

// ── POST /start ──────────────────────────────────────────────────────────────
// Accepts { projectId }, creates an audit run, fires background job immediately.

router.post(
  "/start",
  zValidator("json", z.object({ projectId: z.string().min(1) })),
  async (c) => {
    if (!process.env["CRAWLER_URL"]) {
      return c.json(
        {
          error: "Crawler not configured. Set CRAWLER_URL in .env",
          detail: "Run 'hostname -I' in WSL2 to get the IP, then add CRAWLER_URL=http://<ip>:5001 to .env",
        },
        503
      );
    }

    const orgId = c.get("orgId");
    const db = getDb();
    const { projectId } = c.req.valid("json");

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
    });
    if (!project) return c.json({ error: "Project not found" }, 404);

    const running = await db.query.auditRuns.findFirst({
      where: and(
        eq(auditRuns.projectId, projectId),
        eq(auditRuns.status, "running")
      ),
    });
    if (running) {
      return c.json(
        { error: "An audit is already running for this project", auditRunId: running.id },
        409
      );
    }

    const [run] = await db
      .insert(auditRuns)
      .values({ id: createId(), projectId, status: "pending" })
      .returning();

    // Fire and forget — do not await
    void runAuditBackground(run!.id, project.domain, project.id);

    return c.json({ auditRunId: run!.id }, 202);
  }
);

// ── GET /runs/:projectId ─────────────────────────────────────────────────────

router.get("/runs/:projectId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const runs = await db
    .select({
      id: auditRuns.id,
      projectId: auditRuns.projectId,
      status: auditRuns.status,
      pagesCrawled: auditRuns.pagesCrawled,
      totalIssues: auditRuns.totalIssues,
      criticalIssues: auditRuns.criticalIssues,
      warnings: auditRuns.warnings,
      notices: auditRuns.notices,
      technicalScore: auditRuns.technicalScore,
      cwvScore: auditRuns.cwvScore,
      startedAt: auditRuns.startedAt,
      completedAt: auditRuns.completedAt,
      failureReason: auditRuns.failureReason,
    })
    .from(auditRuns)
    .where(eq(auditRuns.projectId, projectId))
    .orderBy(desc(auditRuns.startedAt))
    .limit(20);

  return c.json({ runs });
});

// ── GET /results/:auditRunId ─────────────────────────────────────────────────

router.get("/results/:auditRunId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { auditRunId } = c.req.param();

  const run = await db.query.auditRuns.findFirst({
    where: eq(auditRuns.id, auditRunId),
    with: { project: true },
  });
  if (!run || run.project.orgId !== orgId) {
    return c.json({ error: "Audit run not found" }, 404);
  }

  const { severity, category } = c.req.query();
  const conditions = [eq(auditIssues.runId, auditRunId)];

  if (severity) {
    conditions.push(
      eq(auditIssues.severity, severity as "critical" | "warning" | "notice")
    );
  }
  if (category) {
    conditions.push(
      eq(
        auditIssues.category,
        category as
          | "meta"
          | "links"
          | "speed"
          | "content"
          | "schema"
          | "mobile"
          | "security"
          | "indexing"
          | "cwv"
          | "ai_search"
      )
    );
  }

  const issues = await db
    .select()
    .from(auditIssues)
    .where(and(...conditions))
    .orderBy(auditIssues.severity, auditIssues.category)
    .limit(500);

  // Group by category for quick access
  const grouped = issues.reduce<Record<string, typeof issues>>(
    (acc, issue) => {
      (acc[issue.category] ??= []).push(issue);
      return acc;
    },
    {}
  );

  // Pages breakdown
  const crawledPages = (run.crawledPages as CrawledPageSummary[]) ?? [];
  const noindexUrls = new Set(
    issues
      .filter((i) => i.category === "indexing" && i.title.toLowerCase().includes("noindex"))
      .flatMap((i) => i.affectedUrls as string[])
  );
  const pagesBreakdown = {
    total: crawledPages.length,
    healthy: crawledPages.filter((p) => p.status_code === 200 && p.issues_count === 0).length,
    has_issues: crawledPages.filter((p) => p.status_code === 200 && p.issues_count > 0).length,
    broken: crawledPages.filter((p) => p.status_code === 404 || p.status_code >= 500).length,
    redirects: crawledPages.filter((p) => p.status_code === 301 || p.status_code === 302).length,
    blocked: crawledPages.filter((p) => noindexUrls.has(p.url)).length,
  };

  return c.json({ run, issues, grouped, pages_breakdown: pagesBreakdown });
});

// ── GET /status/:auditRunId ──────────────────────────────────────────────────

router.get("/status/:auditRunId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { auditRunId } = c.req.param();

  const run = await db.query.auditRuns.findFirst({
    where: eq(auditRuns.id, auditRunId),
    with: { project: true },
  });
  if (!run || run.project.orgId !== orgId) {
    return c.json({ error: "Audit run not found" }, 404);
  }

  return c.json({
    auditRunId: run.id,
    status: run.status,
    pagesCrawled: run.pagesCrawled,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
  });
});

// ── GET /compare/:projectId ──────────────────────────────────────────────────

router.get("/compare/:projectId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();
  const { run1, run2 } = c.req.query();

  if (!run1 || !run2) {
    return c.json({ error: "run1 and run2 query params are required" }, 400);
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const [r1, r2] = await Promise.all([
    db.query.auditRuns.findFirst({ where: eq(auditRuns.id, run1) }),
    db.query.auditRuns.findFirst({ where: eq(auditRuns.id, run2) }),
  ]);

  if (!r1 || r1.projectId !== projectId) return c.json({ error: "run1 not found" }, 404);
  if (!r2 || r2.projectId !== projectId) return c.json({ error: "run2 not found" }, 404);

  const m1 = (r1.rawMetricsJson as RawMetricsJson) ?? {};
  const m2 = (r2.rawMetricsJson as RawMetricsJson) ?? {};

  const metricKeys: (keyof RawMetricsJson)[] = [
    "pages_crawled", "site_health_score", "total_issues", "total_errors",
    "total_warnings", "total_notices", "meta_errors", "meta_warnings",
    "links_errors", "links_warnings", "speed_warnings", "content_warnings",
    "schema_notices", "mobile_errors", "security_errors", "indexing_warnings",
    "cwv_failures", "ai_search_issues",
  ];

  const diff: Record<string, { before: number; after: number; delta: number; improved: boolean }> = {};
  for (const key of metricKeys) {
    const before = (m1[key] as number | undefined) ?? 0;
    const after = (m2[key] as number | undefined) ?? 0;
    const delta = after - before;
    // For scores, higher is better; for issue counts, lower is better
    const isScore = key === "site_health_score";
    diff[key] = { before, after, delta, improved: isScore ? delta > 0 : delta < 0 };
  }

  return c.json({
    run1: { id: r1.id, date: r1.startedAt, score: r1.technicalScore, metrics: m1 },
    run2: { id: r2.id, date: r2.startedAt, score: r2.technicalScore, metrics: m2 },
    diff,
  });
});

// ── GET /progress/:projectId ─────────────────────────────────────────────────

router.get("/progress/:projectId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const runs = await db
    .select()
    .from(auditRuns)
    .where(and(eq(auditRuns.projectId, projectId), eq(auditRuns.status, "completed")))
    .orderBy(auditRuns.startedAt)
    .limit(50);

  return c.json({
    data: runs.map((r) => ({
      id: r.id,
      createdAt: r.startedAt,
      healthScore: r.technicalScore ?? 0,
      totalIssues: r.totalIssues,
      criticalIssues: r.criticalIssues,
      warnings: r.warnings,
      notices: r.notices,
      pagesCrawled: r.pagesCrawled,
    })),
  });
});

// ── Background job ────────────────────────────────────────────────────────────

async function runAuditBackground(auditRunId: string, domain: string, projectId: string): Promise<void> {
  const crawlerUrl = process.env["CRAWLER_URL"];
  if (!crawlerUrl) {
    console.error(`[audit] CRAWLER_URL not set — cannot run audit ${auditRunId}`);
    await getDb()
      .update(auditRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        failureReason: "Crawler not configured — CRAWLER_URL is missing",
      })
      .where(eq(auditRuns.id, auditRunId));
    return;
  }
  const pageSpeedKey = process.env["GOOGLE_PAGESPEED_API_KEY"];
  console.log(`[audit] using crawler at: ${crawlerUrl}`);
  const db = getDb();

  try {
    await db
      .update(auditRuns)
      .set({ status: "running" })
      .where(eq(auditRuns.id, auditRunId));

    // 1. Crawl the site via local Scrapy service
    console.log(`[audit] crawl started for: ${domain} (run ${auditRunId})`);
    let crawlData: CrawlResult;
    try {
      const crawlRes = await fetch(`${crawlerUrl}/crawl-site`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, max_pages: 9999, use_js: false }),
        signal: AbortSignal.timeout(600_000), // 10 minutes
      });

      if (!crawlRes.ok) {
        const body = await crawlRes.text().catch(() => "");
        throw new Error(
          `Crawler returned HTTP ${crawlRes.status}: ${body}. Make sure the service is running in WSL2.`
        );
      }
      crawlData = (await crawlRes.json()) as CrawlResult;
      console.log(`[audit] crawl completed, pages: ${crawlData.pages?.length ?? 0}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[audit] crawl error: ${msg}`);
      const isCrawlerDown =
        msg.includes("ECONNREFUSED") ||
        msg.includes("fetch failed") ||
        msg.includes("TimeoutError") ||
        msg.includes("ETIMEDOUT");
      throw new Error(
        isCrawlerDown
          ? "Crawler service is not running. Please start it in WSL2."
          : msg
      );
    }

    // 2. Google PageSpeed API for Core Web Vitals
    let pageSpeedResult = null;
    if (pageSpeedKey) {
      try {
        const psRes = await fetch(
          `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://${domain}&key=${pageSpeedKey}&strategy=mobile`,
          { signal: AbortSignal.timeout(30_000) }
        );
        if (psRes.ok) {
          pageSpeedResult = extractPageSpeed(await psRes.json());
          console.log(`[audit] pagespeed fetched, score: ${pageSpeedResult?.performance_score ?? "n/a"}`);
        } else {
          console.log(`[audit] pagespeed returned HTTP ${psRes.status}, skipping CWV`);
        }
      } catch (err) {
        console.log(`[audit] pagespeed error (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 3. Run audit rules engine
    const report = runAuditRules(crawlData, pageSpeedResult);
    console.log(`[audit] rules done — score: ${report.healthScore}, issues: ${report.issues.length} (${report.criticalCount} critical, ${report.warningCount} warning, ${report.noticeCount} notice)`);

    // 3b. Site-level checks (www resolve, llms.txt, robots.txt AI bots)
    const siteIssues: AuditIssue[] = [];
    const aiCrawlerAccess: AiCrawlerAccess = {};

    // WWW resolve check
    const wwwIssue = await checkWwwResolve(domain).catch(() => null);
    if (wwwIssue) siteIssues.push(wwwIssue);

    // llms.txt check
    let llmsTxtFound = false;
    try {
      const llmsRes = await fetch(`https://${domain}/llms.txt`, {
        signal: AbortSignal.timeout(5000),
        redirect: "follow",
      });
      if (llmsRes.status === 404) {
        siteIssues.push({
          severity: "notice",
          category: "ai_search",
          url: null,
          affectedUrls: [],
          title: "llms.txt Not Found",
          description: "llms.txt is the emerging standard for telling AI crawlers what content to index.",
          recommendation: "Create /llms.txt — see https://llmstxt.org",
          affectedCount: 0,
        });
      } else if (llmsRes.ok) {
        const text = await llmsRes.text().catch(() => "");
        llmsTxtFound = true;
        if (!text.includes("# ")) {
          siteIssues.push({
            severity: "notice",
            category: "ai_search",
            url: null,
            affectedUrls: [],
            title: "llms.txt Has Formatting Issues",
            description: "The llms.txt file was found but does not contain a required # heading.",
            recommendation: "Add a # heading at the top of /llms.txt as required by the spec — see https://llmstxt.org",
            affectedCount: 0,
          });
        }
      }
    } catch {
      // Non-fatal — skip
    }

    // robots.txt AI bot detection
    const AI_BOTS: Array<{ agent: string; key: keyof AiCrawlerAccess }> = [
      { agent: "ChatGPT-User", key: "chatgpt_user" },
      { agent: "OAI-SearchBot", key: "oai_searchbot" },
      { agent: "GPTBot", key: "gptbot" },
      { agent: "Google-Extended", key: "google_extended" },
      { agent: "PerplexityBot", key: "perplexitybot" },
      { agent: "ClaudeBot", key: "claudebot" },
    ];
    for (const bot of AI_BOTS) aiCrawlerAccess[bot.key] = "unknown";

    try {
      const robotsRes = await fetch(`https://${domain}/robots.txt`, {
        signal: AbortSignal.timeout(5000),
      });
      if (robotsRes.status === 404) {
        siteIssues.push({
          severity: "notice",
          category: "indexing",
          url: null,
          affectedUrls: [],
          title: "robots.txt Not Found",
          description: "No robots.txt file was found at the root of your domain.",
          recommendation: "Create a robots.txt file to guide crawler access to your site.",
          affectedCount: 0,
        });
      } else if (robotsRes.ok) {
        const robotsTxt = await robotsRes.text();

        // W22: Check for Sitemap directive
        if (!robotsTxt.toLowerCase().includes("sitemap:")) {
          siteIssues.push({
            severity: "warning",
            category: "indexing",
            url: null,
            affectedUrls: [],
            title: "Sitemap Not Referenced in robots.txt",
            description: "Your robots.txt file exists but does not include a Sitemap: directive.",
            recommendation: `Add 'Sitemap: https://${domain}/sitemap.xml' to your robots.txt file so crawlers can discover your sitemap.`,
            affectedCount: 0,
          });
        }

        const lines = robotsTxt.split("\n").map((l) => l.trim());

        let currentAgents: string[] = [];
        for (const line of lines) {
          const lower = line.toLowerCase();
          if (lower.startsWith("user-agent:")) {
            const agent = line.slice("user-agent:".length).trim();
            currentAgents.push(agent);
          } else if (lower.startsWith("disallow:") || lower.startsWith("allow:")) {
            const isDisallow = lower.startsWith("disallow:");
            const path = line.slice(line.indexOf(":") + 1).trim();

            for (const bot of AI_BOTS) {
              const matchesAgent = currentAgents.some(
                (a) => a === "*" || a.toLowerCase() === bot.agent.toLowerCase()
              );
              if (matchesAgent && path === "/") {
                aiCrawlerAccess[bot.key] = isDisallow ? "blocked" : "allowed";
              } else if (matchesAgent && !isDisallow && aiCrawlerAccess[bot.key] === "unknown") {
                aiCrawlerAccess[bot.key] = "allowed";
              }
            }
          } else if (line === "") {
            currentAgents = [];
          }
        }

        // Any bot still "unknown" after parsing and not "*" blocked → treat as allowed
        for (const bot of AI_BOTS) {
          if (aiCrawlerAccess[bot.key] === "unknown") {
            aiCrawlerAccess[bot.key] = "allowed";
          }
        }

        // Generate issues for blocked bots
        for (const bot of AI_BOTS) {
          if (aiCrawlerAccess[bot.key] === "blocked") {
            siteIssues.push({
              severity: "warning",
              category: "ai_search",
              url: null,
              affectedUrls: [],
              title: `${bot.agent} Is Blocked From Crawling`,
              description: `${bot.agent} is blocked by robots.txt. This prevents this AI crawler from indexing your content.`,
              recommendation: `Remove the Disallow: / rule for ${bot.agent} in robots.txt to allow AI search indexing.`,
              affectedCount: 0,
            });
          }
        }
      }
    } catch {
      // Non-fatal — skip
    }

    // W23: Check that sitemap.xml or sitemap_index.xml exists
    try {
      const [sitemapRes, sitemapIdxRes] = await Promise.allSettled([
        fetch(`https://${domain}/sitemap.xml`, { signal: AbortSignal.timeout(5000) }),
        fetch(`https://${domain}/sitemap_index.xml`, { signal: AbortSignal.timeout(5000) }),
      ]);
      const sitemapOk = sitemapRes.status === "fulfilled" && sitemapRes.value.ok;
      const sitemapIdxOk = sitemapIdxRes.status === "fulfilled" && sitemapIdxRes.value.ok;
      if (!sitemapOk && !sitemapIdxOk) {
        siteIssues.push({
          severity: "warning",
          category: "indexing",
          url: null,
          affectedUrls: [],
          title: "sitemap.xml Not Found",
          description: "Neither /sitemap.xml nor /sitemap_index.xml returned a valid response.",
          recommendation: "Create and submit a sitemap to help search engines discover all your pages.",
          affectedCount: 0,
        });
      }
    } catch {
      // Non-fatal — skip
    }

    // 3c. PageSpeed for top GSC pages (non-blocking, runs in parallel)
    const pagespeedEntries: PageSpeedEntry[] = [];
    if (pageSpeedKey) {
      try {
        const psClient = new PageSpeedClient(pageSpeedKey);

        // Query ClickHouse for top 5 pages by GSC traffic (last 30 days)
        let gscPages: Array<{ page: string }> = [];
        try {
          gscPages = await clickhouse.query<{ page: string; total_clicks: string }>(
            `SELECT page, SUM(clicks) AS total_clicks
             FROM gsc_metrics
             WHERE project_id = '${projectId}'
               AND date >= today() - 30
             GROUP BY page
             ORDER BY total_clicks DESC
             LIMIT 5`
          );
        } catch {
          // ClickHouse not available or no GSC data — will fall back to homepage
        }

        // Build full URLs; fall back to homepage if no GSC data
        const urlsToCheck: string[] =
          gscPages.length > 0
            ? gscPages.map((r) => {
                const p = r.page;
                if (p.startsWith("http")) return p;
                return `https://${domain}${p.startsWith("/") ? p : `/${p}`}`;
              })
            : [`https://${domain}`];

        const homepageUrl = `https://${domain}`;

        const results = await Promise.allSettled(
          urlsToCheck.map(async (url) => {
            const [mobile, desktop] = await Promise.allSettled([
              psClient.analyze(url, "mobile"),
              psClient.analyze(url, "desktop"),
            ]);
            return { url, mobile, desktop };
          })
        );

        for (const result of results) {
          if (result.status !== "fulfilled") continue;
          const { url, mobile, desktop } = result.value;
          if (mobile.status !== "fulfilled") continue;
          const m = mobile.value;
          const d = desktop.status === "fulfilled" ? desktop.value : null;

          pagespeedEntries.push({
            url,
            is_homepage: url === homepageUrl,
            mobile_score: m.performance_score,
            desktop_score: d?.performance_score ?? m.performance_score,
            lcp_ms: m.lcp,
            cls: m.cls,
            tbt_ms: m.tbt,
            fcp_ms: m.fcp,
            opportunities: m.opportunities
              .filter((o) => o.savings_ms > 0)
              .slice(0, 5)
              .map((o) => ({ title: o.title, savings_ms: o.savings_ms })),
          });
        }
        console.log(`[audit] pagespeed top-pages: ${pagespeedEntries.length} entries collected`);
      } catch (err) {
        console.log(`[audit] pagespeed top-pages error (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Generate CWV issues from pagespeed entries
    const pagespeedIssues: AuditIssue[] = [];
    for (const entry of pagespeedEntries) {
      const label = entry.is_homepage ? "homepage" : entry.url;
      if (entry.mobile_score < 50) {
        pagespeedIssues.push({
          severity: "critical",
          category: "cwv",
          url: entry.url,
          affectedUrls: [entry.url],
          title: `Poor mobile PageSpeed score on ${label}`,
          description: `Mobile PageSpeed score is ${entry.mobile_score}/100.`,
          recommendation: "Address render-blocking resources, reduce server response time, and optimize images.",
          affectedCount: 1,
        });
      } else if (entry.mobile_score < 70) {
        pagespeedIssues.push({
          severity: "warning",
          category: "cwv",
          url: entry.url,
          affectedUrls: [entry.url],
          title: `Mobile PageSpeed needs improvement on ${label}`,
          description: `Mobile PageSpeed score is ${entry.mobile_score}/100.`,
          recommendation: "Review PageSpeed opportunities and address top savings items.",
          affectedCount: 1,
        });
      }
      if (entry.lcp_ms > 2500) {
        pagespeedIssues.push({
          severity: "critical",
          category: "cwv",
          url: entry.url,
          affectedUrls: [entry.url],
          title: `Slow LCP on ${label}`,
          description: `Largest Contentful Paint is ${(entry.lcp_ms / 1000).toFixed(2)}s (threshold: 2.5s).`,
          recommendation: "Optimize the largest visible element — reduce image size, improve TTFB, or use a CDN.",
          affectedCount: 1,
        });
      }
      if (entry.cls > 0.1) {
        pagespeedIssues.push({
          severity: "warning",
          category: "cwv",
          url: entry.url,
          affectedUrls: [entry.url],
          title: `High CLS on ${label}`,
          description: `Cumulative Layout Shift is ${entry.cls.toFixed(3)} (threshold: 0.1).`,
          recommendation: "Set explicit size attributes on images and embeds; avoid inserting content above existing content.",
          affectedCount: 1,
        });
      }
    }

    const allIssues = [...report.issues, ...siteIssues, ...pagespeedIssues];
    const allCriticalCount = allIssues.filter((i) => i.severity === "critical").length;
    const allWarningCount = allIssues.filter((i) => i.severity === "warning").length;
    const allNoticeCount = allIssues.filter((i) => i.severity === "notice").length;
    console.log(`[audit] site checks done — ${siteIssues.length} additional issues, llms.txt: ${llmsTxtFound}`);

    // 4. Build per-page issue counts for the crawled_pages summary
    const issueCountByUrl = new Map<string, number>();
    for (const issue of allIssues) {
      for (const url of issue.affectedUrls) {
        issueCountByUrl.set(url, (issueCountByUrl.get(url) ?? 0) + 1);
      }
    }

    const crawledPagesSummary: CrawledPageSummary[] = crawlData.pages.map((page) => ({
      url: page.url,
      status_code: page.status_code,
      title: page.title?.trim() ? page.title.trim() : null,
      has_meta_desc: !!page.meta_description?.trim(),
      has_h1: !!(page.h1 && page.h1.length > 0),
      word_count: page.word_count ?? 0,
      is_https: page.is_https ?? false,
      issues_count: issueCountByUrl.get(page.url) ?? 0,
      has_json_ld: page.has_json_ld ?? false,
      has_canonical: !!page.canonical,
      incoming_links_count: report.incomingLinksCount.get(page.url) ?? 0,
    }));

    // 5. Persist issues with all affected URLs
    if (allIssues.length > 0) {
      await db.insert(auditIssues).values(
        allIssues.map((issue) => ({
          id: createId(),
          runId: auditRunId,
          severity: issue.severity,
          category: issue.category as "meta" | "links" | "speed" | "content" | "schema" | "mobile" | "security" | "indexing" | "cwv" | "ai_search",
          url: issue.url,
          affectedUrls: issue.affectedUrls,
          title: issue.title,
          description: issue.description,
          recommendation: issue.recommendation,
          affectedCount: issue.affectedCount,
        }))
      );
    }

    // Build raw metrics for comparison
    const rawMetrics: RawMetricsJson = {
      pages_crawled: report.pagesCrawled,
      site_health_score: report.healthScore,
      total_issues: allIssues.length,
      total_errors: allCriticalCount,
      total_warnings: allWarningCount,
      total_notices: allNoticeCount,
      meta_errors: allIssues.filter((i) => i.category === "meta" && i.severity === "critical").length,
      meta_warnings: allIssues.filter((i) => i.category === "meta" && i.severity === "warning").length,
      links_errors: allIssues.filter((i) => i.category === "links" && i.severity === "critical").length,
      links_warnings: allIssues.filter((i) => i.category === "links" && i.severity === "warning").length,
      speed_warnings: allIssues.filter((i) => i.category === "speed" && i.severity === "warning").length,
      content_warnings: allIssues.filter((i) => i.category === "content" && i.severity === "warning").length,
      schema_notices: allIssues.filter((i) => i.category === "schema" && i.severity === "notice").length,
      mobile_errors: allIssues.filter((i) => i.category === "mobile" && i.severity === "critical").length,
      security_errors: allIssues.filter((i) => i.category === "security" && i.severity === "critical").length,
      indexing_warnings: allIssues.filter((i) => i.category === "indexing" && i.severity === "warning").length,
      cwv_failures: allIssues.filter((i) => i.category === "cwv").length,
      ai_search_issues: siteIssues.filter((i) => i.category === "ai_search").length,
      ai_search_score: Math.max(
        0,
        Math.min(100, 100 - allIssues.filter((i) => i.category === "ai_search").length * 15)
      ),
      llms_txt_found: llmsTxtFound,
    };

    // 6. Mark completed (with per-page summary)
    await db
      .update(auditRuns)
      .set({
        status: "completed",
        pagesCrawled: report.pagesCrawled,
        totalIssues: allIssues.length,
        criticalIssues: allCriticalCount,
        warnings: allWarningCount,
        notices: allNoticeCount,
        technicalScore: report.healthScore,
        cwvScore: report.cwvScore,
        crawledPages: crawledPagesSummary,
        aiCrawlerAccess: aiCrawlerAccess,
        rawMetricsJson: rawMetrics,
        pagespeedResults: pagespeedEntries,
        completedAt: new Date(),
      })
      .where(eq(auditRuns.id, auditRunId));

    console.log(`[audit] run ${auditRunId} completed`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[audit] run ${auditRunId} failed:`, msg);
    await db
      .update(auditRuns)
      .set({ status: "failed", completedAt: new Date(), failureReason: msg })
      .where(eq(auditRuns.id, auditRunId))
      .catch((dbErr: unknown) => {
        console.error(`[audit] could not update run to failed:`, dbErr instanceof Error ? dbErr.message : dbErr);
      });
  }
}

export default router;
