import "../types.js";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../lib/db/index.js";
import { clickhouse } from "../lib/clickhouse/index.js";
import {
  reports,
  projects,
  auditRuns,
  auditIssues,
  trackedKeywords,
  type ReportData,
  createId,
} from "@garage-seo/db";
import { ClaudeClient } from "@garage-seo/ai";

const router = new Hono();

const DATE_RANGE_DAYS: Record<string, number> = {
  "30d": 30,
  "90d": 90,
  "180d": 180,
};

// ── POST /generate ─────────────────────────────────────────────────────────────

router.post(
  "/generate",
  zValidator(
    "json",
    z.object({
      projectId: z.string().min(1),
      title: z.string().min(1).max(200),
      type: z.enum(["full_seo", "keyword_report", "audit_report", "custom"]),
      sections: z.array(z.string()).min(1),
      dateRange: z.enum(["30d", "90d", "180d"]).default("30d"),
    })
  ),
  async (c) => {
    const orgId = c.get("orgId");
    const db = getDb();
    const { projectId, title, type, sections, dateRange } = c.req.valid("json");

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
    });
    if (!project) return c.json({ error: "Project not found" }, 404);

    const [report] = await db
      .insert(reports)
      .values({
        id: createId(),
        projectId,
        orgId,
        type,
        title,
        status: "generating",
        sections,
        dateRange,
      })
      .returning();

    void generateReportBackground(report!.id, project, sections, dateRange);

    return c.json({ reportId: report!.id }, 202);
  }
);

// ── GET /projects/:projectId ───────────────────────────────────────────────────

router.get("/projects/:projectId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const rows = await db
    .select()
    .from(reports)
    .where(and(eq(reports.projectId, projectId), eq(reports.orgId, orgId)))
    .orderBy(desc(reports.createdAt))
    .limit(50);

  return c.json({
    reports: rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      status: r.status,
      sections: r.sections,
      dateRange: r.dateRange,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      failureReason: r.failureReason,
      projectName: project.name,
      projectDomain: project.domain,
    })),
  });
});

// ── GET /:reportId ─────────────────────────────────────────────────────────────

router.get("/:reportId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { reportId } = c.req.param();

  const report = await db.query.reports.findFirst({
    where: and(eq(reports.id, reportId), eq(reports.orgId, orgId)),
    with: { project: true },
  });
  if (!report) return c.json({ error: "Report not found" }, 404);

  return c.json({ report });
});

// ── DELETE /:reportId ─────────────────────────────────────────────────────────

router.delete("/:reportId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { reportId } = c.req.param();

  const report = await db.query.reports.findFirst({
    where: and(eq(reports.id, reportId), eq(reports.orgId, orgId)),
  });
  if (!report) return c.json({ error: "Report not found" }, 404);

  await db.delete(reports).where(eq(reports.id, reportId));
  return c.json({ ok: true });
});

// ── Background generation ─────────────────────────────────────────────────────

async function generateReportBackground(
  reportId: string,
  project: { id: string; domain: string; name: string; gscConnected: boolean },
  sections: string[],
  dateRange: string
): Promise<void> {
  const db = getDb();
  const days = DATE_RANGE_DAYS[dateRange] ?? 30;

  try {
    const reportData: ReportData = {
      title: "",
      type: "",
      sections,
      dateRange,
      generatedAt: new Date().toISOString(),
      project: { id: project.id, domain: project.domain, name: project.name },
    };

    // 1. Latest completed audit
    const latestAudit = await db.query.auditRuns.findFirst({
      where: and(eq(auditRuns.projectId, project.id), eq(auditRuns.status, "completed")),
      orderBy: [desc(auditRuns.completedAt)],
    });

    const prevAudit = latestAudit
      ? await db.query.auditRuns.findFirst({
          where: and(
            eq(auditRuns.projectId, project.id),
            eq(auditRuns.status, "completed")
          ),
          orderBy: [desc(auditRuns.completedAt)],
          offset: 1,
        })
      : null;

    if (latestAudit && sections.includes("site_health")) {
      reportData.siteHealth = {
        score: latestAudit.technicalScore ?? 0,
        criticalIssues: latestAudit.criticalIssues,
        warnings: latestAudit.warnings,
        notices: latestAudit.notices,
        pagesCrawled: latestAudit.pagesCrawled,
        cwvScore: latestAudit.cwvScore ?? null,
        previousScore: prevAudit?.technicalScore ?? null,
      };
    }

    if (latestAudit && sections.includes("ai_search")) {
      const rawMetrics = (latestAudit.rawMetricsJson ?? {}) as Record<string, unknown>;
      const aiCrawlerAccess = (latestAudit.aiCrawlerAccess ?? {}) as Record<string, string>;
      reportData.aiSearch = {
        score: (rawMetrics["ai_search_score"] as number | undefined) ?? 100,
        llmsTxtFound: (rawMetrics["llms_txt_found"] as boolean | undefined) ?? false,
        botAccess: aiCrawlerAccess,
      };
    }

    if (latestAudit && sections.includes("cwv")) {
      const psResults = (latestAudit.pagespeedResults ?? []) as Array<{
        is_homepage: boolean;
        mobile_score: number;
        desktop_score: number;
        lcp_ms: number;
        cls: number;
      }>;
      const homepage = psResults.find((e) => e.is_homepage) ?? psResults[0] ?? null;
      reportData.cwv = homepage
        ? {
            mobileScore: homepage.mobile_score,
            desktopScore: homepage.desktop_score,
            lcp_ms: homepage.lcp_ms,
            cls: homepage.cls,
          }
        : { mobileScore: null, desktopScore: null, lcp_ms: null, cls: null };
    }

    // 2. Technical issues
    if (latestAudit && sections.includes("technical_issues")) {
      const issues = await db
        .select({
          title: auditIssues.title,
          description: auditIssues.description,
          recommendation: auditIssues.recommendation,
          severity: auditIssues.severity,
          affectedCount: auditIssues.affectedCount,
        })
        .from(auditIssues)
        .where(eq(auditIssues.runId, latestAudit.id))
        .orderBy(auditIssues.severity, auditIssues.affectedCount)
        .limit(100);

      reportData.technicalIssues = {
        critical: issues
          .filter((i) => i.severity === "critical")
          .slice(0, 5)
          .map((i) => ({
            title: i.title,
            description: i.description,
            recommendation: i.recommendation,
            affectedCount: i.affectedCount,
          })),
        warnings: issues
          .filter((i) => i.severity === "warning")
          .slice(0, 5)
          .map((i) => ({
            title: i.title,
            description: i.description,
            recommendation: i.recommendation,
            affectedCount: i.affectedCount,
          })),
        crawledPages: latestAudit.pagesCrawled,
      };
    }

    // 3. Keyword data from Postgres + ClickHouse
    if (sections.includes("keywords")) {
      try {
        const trackedKws = await db
          .select({ id: trackedKeywords.id, keyword: trackedKeywords.keyword })
          .from(trackedKeywords)
          .where(eq(trackedKeywords.projectId, project.id))
          .limit(500);

        if (trackedKws.length > 0) {
          const kwRows = await clickhouse.query<{ keyword_id: string; pos: string }>(
            `SELECT keyword_id, round(avg(position)) AS pos
             FROM rank_history
             WHERE project_id = '${project.id}'
               AND checked_at >= now() - INTERVAL ${days} DAY
             GROUP BY keyword_id`
          );

          const posMap = new Map(kwRows.map((r) => [r.keyword_id, Number(r.pos)]));
          const kwWithPos = trackedKws
            .map((kw) => ({ keyword: kw.keyword, position: posMap.get(kw.id) ?? 0 }))
            .filter((k) => k.position > 0)
            .sort((a, b) => a.position - b.position);

          reportData.keywords = {
            total: trackedKws.length,
            top3: kwWithPos.filter((k) => k.position <= 3).length,
            top10: kwWithPos.filter((k) => k.position <= 10).length,
            top100: kwWithPos.filter((k) => k.position <= 100).length,
            topKeywords: kwWithPos.slice(0, 10),
          };
        }
      } catch {
        // ClickHouse not available — skip keywords section
      }
    }

    // 4. GSC data from ClickHouse
    if (sections.includes("gsc") && project.gscConnected) {
      try {
        const [totalsRows, pageRows] = await Promise.all([
          clickhouse.query<{ total_clicks: string; total_impressions: string; avg_ctr: string; avg_position: string }>(
            `SELECT
               SUM(clicks) AS total_clicks,
               SUM(impressions) AS total_impressions,
               avg(ctr) AS avg_ctr,
               avg(position) AS avg_position
             FROM gsc_metrics
             WHERE project_id = '${project.id}'
               AND date >= today() - ${days}`
          ),
          clickhouse.query<{ page: string; clicks: string; impressions: string }>(
            `SELECT page, SUM(clicks) AS clicks, SUM(impressions) AS impressions
             FROM gsc_metrics
             WHERE project_id = '${project.id}'
               AND date >= today() - ${days}
             GROUP BY page
             ORDER BY clicks DESC
             LIMIT 5`
          ),
        ]);

        const totals = totalsRows[0];
        if (totals) {
          reportData.gsc = {
            totalClicks: Number(totals.total_clicks ?? 0),
            totalImpressions: Number(totals.total_impressions ?? 0),
            avgCtr: Math.round(Number(totals.avg_ctr ?? 0) * 10000) / 100,
            avgPosition: Math.round(Number(totals.avg_position ?? 0) * 10) / 10,
            topPages: pageRows.map((r) => ({
              page: r.page,
              clicks: Number(r.clicks),
              impressions: Number(r.impressions),
            })),
          };
        }
      } catch {
        // ClickHouse not available — skip GSC section
      }
    }

    // 5. Generate executive summary via Claude
    if (sections.includes("executive_summary")) {
      try {
        const claude = new ClaudeClient();
        const health = reportData.siteHealth;
        const kw = reportData.keywords;
        const gsc = reportData.gsc;
        const cwv = reportData.cwv;
        const lcpVal = cwv?.lcp_ms ? (cwv.lcp_ms / 1000).toFixed(1) : "N/A";
        const lcpStatus = cwv?.lcp_ms ? (cwv.lcp_ms <= 2500 ? "pass" : "fail") : "N/A";

        const totalIssues = health ? health.criticalIssues + health.warnings + health.notices : 0;

        const userPrompt = `Generate an executive summary for this SEO report.

Project: ${project.name} (${project.domain})
Health Score: ${health?.score ?? "N/A"}/100
Pages Crawled: ${health?.pagesCrawled ?? "N/A"}
Total Issues: ${totalIssues} (${health?.criticalIssues ?? 0} critical, ${health?.warnings ?? 0} warnings, ${health?.notices ?? 0} notices)
LCP: ${lcpVal}s (${lcpStatus})
Tracked Keywords: ${kw?.total ?? 0}
Keywords in Top 10: ${kw?.top10 ?? 0}
GSC Clicks (${dateRange}): ${gsc?.totalClicks ?? "N/A"}
GSC Avg Position: ${gsc?.avgPosition ?? "N/A"}

Return valid JSON only (no markdown, no explanation):
{
  "overview": "2-3 sentence professional overview using specific numbers from the data above. Include health score with a rating label (Excellent/Good/Needs Improvement/Poor), pages crawled, total issues, critical count, and LCP performance verdict if available.",
  "wins": ["win 1", "win 2", "win 3"],
  "issues": ["issue 1", "issue 2", "issue 3"],
  "actions": [
    {"priority": "high", "action": "specific action", "impact": "expected impact"},
    {"priority": "high", "action": "specific action", "impact": "expected impact"},
    {"priority": "medium", "action": "specific action", "impact": "expected impact"},
    {"priority": "medium", "action": "specific action", "impact": "expected impact"},
    {"priority": "low", "action": "specific action", "impact": "expected impact"}
  ]
}`;

        const res = await claude["client"].messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system:
            "You are an SEO analyst writing professional client reports. Respond with valid JSON only, no markdown fences.",
          messages: [{ role: "user", content: userPrompt }],
        });

        const text = (res.content.find((b: { type: string }) => b.type === "text") as { type: "text"; text: string } | undefined)?.text ?? "{}";
        const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
        const parsed = JSON.parse(cleaned) as {
          overview?: string;
          wins?: string[];
          issues?: string[];
          actions?: Array<{ priority: string; action: string; impact: string }>;
        };

        reportData.executiveSummary = {
          overview: parsed.overview ?? "",
          wins: parsed.wins ?? [],
          issues: parsed.issues ?? [],
          actions: parsed.actions ?? [],
        };
      } catch (err) {
        console.log(`[reports] Claude executive summary failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
        const h = reportData.siteHealth;
        const kws = reportData.keywords;
        const g = reportData.gsc;
        const c = reportData.cwv;
        const score = h?.score ?? null;
        const criticalCount = h?.criticalIssues ?? 0;
        const warningCount = h?.warnings ?? 0;
        const lcpMs = c?.lcp_ms ?? null;
        const lcpOk = lcpMs != null ? lcpMs <= 2500 : null;

        const fallbackWins: string[] = [];
        const fallbackIssues: string[] = [];
        const fallbackActions: Array<{ priority: string; action: string; impact: string }> = [];

        if (score != null && score >= 80) fallbackWins.push(`Strong site health score of ${Math.round(score)}/100`);
        if (kws?.top10) fallbackWins.push(`${kws.top10} keyword${kws.top10 !== 1 ? "s" : ""} ranking in the top 10`);
        if (g?.totalClicks) fallbackWins.push(`${g.totalClicks.toLocaleString()} organic clicks in the reporting period`);
        if (lcpOk === true) fallbackWins.push("Core Web Vitals LCP meets the Good threshold (≤ 2.5 s)");

        if (criticalCount > 0) fallbackIssues.push(`${criticalCount} critical technical issue${criticalCount > 1 ? "s" : ""} requiring immediate attention`);
        if (warningCount > 0) fallbackIssues.push(`${warningCount} warnings impacting site performance`);
        if (lcpOk === false && lcpMs != null) fallbackIssues.push(`LCP of ${(lcpMs / 1000).toFixed(1)} s exceeds the 2.5 s Good threshold`);
        if (score != null && score < 50) fallbackIssues.push("Site health score below 50 — a comprehensive technical audit is recommended");

        if (criticalCount > 0) fallbackActions.push({ priority: "high", action: "Fix all critical technical issues", impact: "Improve crawlability and indexation" });
        if (lcpOk === false) fallbackActions.push({ priority: "high", action: "Optimise Largest Contentful Paint", impact: "Better Core Web Vitals and ranking potential" });
        if (warningCount > 0) fallbackActions.push({ priority: "medium", action: "Address site warnings", impact: "Incremental SEO gains" });
        if (kws && kws.top10 > 0) fallbackActions.push({ priority: "medium", action: "Target keywords ranked 4–10 with content updates", impact: "Push more keywords into top 3 positions" });
        fallbackActions.push({ priority: "low", action: "Review GSC performance trends monthly", impact: "Catch ranking changes early" });

        const scoreLabel =
          score == null ? null
          : score >= 80 ? "Excellent"
          : score >= 70 ? "Good"
          : score >= 50 ? "Needs Improvement"
          : "Poor";

        const totalFallbackIssues = (h?.criticalIssues ?? 0) + (h?.warnings ?? 0) + (h?.notices ?? 0);
        const pagesCrawled = h?.pagesCrawled ?? 0;

        let overview = "";
        if (score != null && scoreLabel) {
          overview = `${project.name} (${project.domain}) achieved a site health score of ${Math.round(score)}/100 — rated ${scoreLabel}.`;
          if (pagesCrawled > 0) {
            overview += ` The crawl covered ${pagesCrawled.toLocaleString()} pages and identified ${totalFallbackIssues} total issue${totalFallbackIssues !== 1 ? "s" : ""} including ${criticalCount} critical item${criticalCount !== 1 ? "s" : ""} requiring immediate attention.`;
          }
          if (lcpMs != null) {
            overview += lcpOk === false
              ? ` Page load performance needs improvement with an LCP of ${(lcpMs / 1000).toFixed(1)}s exceeding Google's 2.5s threshold.`
              : ` Page load performance is strong with an LCP of ${(lcpMs / 1000).toFixed(1)}s meeting Google's Good threshold.`;
          }
        } else {
          overview = `SEO report for ${project.name} (${project.domain}).`;
        }

        reportData.executiveSummary = {
          overview,
          wins: fallbackWins.length ? fallbackWins : ["Site is being actively tracked"],
          issues: fallbackIssues.length ? fallbackIssues : ["No critical issues detected"],
          actions: fallbackActions,
        };
      }
    }

    // 6. Build recommendations from issues + Claude actions
    if (sections.includes("recommendations")) {
      const fromIssues: ReportData["recommendations"] = (
        reportData.technicalIssues?.critical.slice(0, 3) ?? []
      ).map((issue) => ({
        priority: "high" as const,
        action: issue.recommendation || issue.title,
        impact: `Fix ${issue.affectedCount} affected page${issue.affectedCount !== 1 ? "s" : ""}`,
      }));

      const fromClaude = (reportData.executiveSummary?.actions ?? []).map((a) => ({
        priority: (a.priority === "high" || a.priority === "medium" || a.priority === "low" ? a.priority : "medium") as "high" | "medium" | "low",
        action: a.action,
        impact: a.impact,
      }));

      const combined = [...fromIssues, ...fromClaude];
      const seen = new Set<string>();
      reportData.recommendations = combined
        .filter((r) => {
          if (seen.has(r.action)) return false;
          seen.add(r.action);
          return true;
        })
        .slice(0, 5);
    }

    // 7. Store and mark complete
    await db
      .update(reports)
      .set({
        status: "ready",
        reportData,
        completedAt: new Date(),
      })
      .where(eq(reports.id, reportId));

    console.log(`[reports] report ${reportId} completed`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[reports] report ${reportId} failed:`, msg);
    await db
      .update(reports)
      .set({ status: "failed", failureReason: msg, completedAt: new Date() })
      .where(eq(reports.id, reportId))
      .catch(() => {});
  }
}

export default router;
