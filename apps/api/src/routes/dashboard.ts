import "../types.js";
import { Hono } from "hono";
import { getDb } from "../lib/db/index.js";
import { clickhouse } from "../lib/clickhouse/index.js";
import { backlinkSnapshots, projects, auditRuns } from "@garage-seo/db";
import { eq, and, desc } from "drizzle-orm";

const router = new Hono();

router.get("/:projectId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Latest two backlink snapshots for current value + delta
  const backlinksSnaps = await db
    .select()
    .from(backlinkSnapshots)
    .where(eq(backlinkSnapshots.projectId, projectId))
    .orderBy(desc(backlinkSnapshots.checkedAt))
    .limit(2);

  const latestSnap = backlinksSnaps[0] ?? null;
  const prevSnap = backlinksSnaps[1] ?? null;

  // Latest completed audit for content score and pages-with-issues
  const latestAudit = await db.query.auditRuns.findFirst({
    where: and(eq(auditRuns.projectId, projectId), eq(auditRuns.status, "completed")),
    orderBy: [desc(auditRuns.completedAt)],
  });

  const rawMetrics = latestAudit?.rawMetricsJson as Record<string, unknown> | null;
  const contentWarnings = (rawMetrics?.content_warnings as number | undefined) ?? 0;
  const pagesCrawled = latestAudit?.pagesCrawled ?? 0;
  const contentScore =
    pagesCrawled > 0
      ? Math.max(0, Math.round(100 - (contentWarnings / pagesCrawled) * 200))
      : null;

  const crawledPages = (latestAudit?.crawledPages ?? []) as Array<{ issues_count: number }>;
  const pagesWithIssues = crawledPages.filter((p) => p.issues_count > 0).length;

  // ClickHouse: all three queries run in parallel with independent fallbacks
  let keywordDistribution: Record<string, number> = {};
  let keywordChanges = { newKeywords: 0, lostKeywords: 0 };
  let topPages: Array<{ url: string; position: number; kwCount: number }> = [];

  await Promise.allSettled([
    (async () => {
      const rows = await clickhouse.query<{ bucket: string; cnt: string }>(
        `SELECT
          multiIf(
            position <= 3,   'top3',
            position <= 10,  'p4_10',
            position <= 20,  'p11_20',
            position <= 50,  'p21_50',
            position <= 100, 'p51_100',
            'p100plus'
          ) AS bucket,
          count() AS cnt
        FROM rank_history
        WHERE project_id = '${projectId}'
          AND checked_at >= now() - INTERVAL 2 DAY
        GROUP BY bucket`
      );
      for (const row of rows) keywordDistribution[row.bucket] = Number(row.cnt);
    })(),

    (async () => {
      const [newRows, lostRows] = await Promise.all([
        clickhouse.query<{ cnt: string }>(
          `SELECT count() AS cnt
           FROM (
             SELECT keyword_id, min(checked_at) AS first_seen
             FROM rank_history
             WHERE project_id = '${projectId}'
             GROUP BY keyword_id
           )
           WHERE first_seen >= now() - INTERVAL 7 DAY`
        ),
        clickhouse.query<{ cnt: string }>(
          `SELECT countDistinct(keyword_id) AS cnt
           FROM rank_history
           WHERE project_id = '${projectId}'
             AND checked_at >= now() - INTERVAL 14 DAY
             AND checked_at <  now() - INTERVAL 7 DAY
             AND keyword_id NOT IN (
               SELECT DISTINCT keyword_id
               FROM rank_history
               WHERE project_id = '${projectId}'
                 AND checked_at >= now() - INTERVAL 7 DAY
             )`
        ),
      ]);
      keywordChanges = {
        newKeywords: Number(newRows[0]?.cnt ?? 0),
        lostKeywords: Number(lostRows[0]?.cnt ?? 0),
      };
    })(),

    (async () => {
      const rows = await clickhouse.query<{ url: string; pos: string; kw_count: string }>(
        `SELECT
          url,
          round(avg(position)) AS pos,
          countDistinct(keyword_id) AS kw_count
        FROM rank_history
        WHERE project_id = '${projectId}'
          AND checked_at >= now() - INTERVAL 2 DAY
          AND position <= 100
          AND url != ''
        GROUP BY url
        HAVING kw_count > 0
        ORDER BY pos ASC
        LIMIT 5`
      );
      topPages = rows.map((r) => ({
        url: r.url,
        position: Number(r.pos),
        kwCount: Number(r.kw_count),
      }));
    })(),
  ]);

  return c.json({
    backlinks: {
      referringDomains: latestSnap?.referringDomains ?? null,
      referringDomainsDelta:
        latestSnap && prevSnap
          ? latestSnap.referringDomains - prevSnap.referringDomains
          : null,
      totalBacklinks: latestSnap?.totalBacklinks ?? null,
      domainAuthority: latestSnap?.domainRank ?? null,
      lastCheckedAt: latestSnap?.checkedAt?.toISOString() ?? null,
    },
    contentScore,
    pagesWithIssues,
    pagesCrawled,
    keywordDistribution,
    keywordChanges,
    topPages,
  });
});

export default router;
