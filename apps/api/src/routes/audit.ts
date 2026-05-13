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
  type CrawlResult,
} from "../lib/audit-rules.js";
import type { CrawledPageSummary } from "@garage-seo/db";

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
    void runAuditBackground(run!.id, project.domain);

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
    .select()
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

  return c.json({ run, issues, grouped });
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

// ── Background job ────────────────────────────────────────────────────────────

async function runAuditBackground(auditRunId: string, domain: string): Promise<void> {
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

    // 4. Build per-page issue counts for the crawled_pages summary
    const issueCountByUrl = new Map<string, number>();
    for (const issue of report.issues) {
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
    }));

    // 5. Persist issues with all affected URLs
    if (report.issues.length > 0) {
      await db.insert(auditIssues).values(
        report.issues.map((issue) => ({
          id: createId(),
          runId: auditRunId,
          severity: issue.severity,
          category: issue.category,
          url: issue.url,
          affectedUrls: issue.affectedUrls,
          title: issue.title,
          description: issue.description,
          recommendation: issue.recommendation,
          affectedCount: issue.affectedCount,
        }))
      );
    }

    // 6. Mark completed (with per-page summary)
    await db
      .update(auditRuns)
      .set({
        status: "completed",
        pagesCrawled: report.pagesCrawled,
        totalIssues: report.issues.length,
        criticalIssues: report.criticalCount,
        warnings: report.warningCount,
        notices: report.noticeCount,
        technicalScore: report.healthScore,
        cwvScore: report.cwvScore,
        crawledPages: crawledPagesSummary,
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
