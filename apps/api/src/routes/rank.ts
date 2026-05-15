import "../types.js";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../lib/db/index.js";
import { clickhouse } from "../lib/clickhouse/index.js";
import { projects, trackedKeywords } from "@garage-seo/db";
import { eq, and, inArray } from "drizzle-orm";
import { DataForSEO } from "@garage-seo/dataforseo";

const router = new Hono();

// ── helpers ───────────────────────────────────────────────────────────────────

function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

function toSerpArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string" && raw) {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

// ── /history ──────────────────────────────────────────────────────────────────

router.get("/projects/:projectId/history", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();
  const { keywordId, days = "30" } = c.req.query();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const daysNum = Math.min(parseInt(days, 10), 365);

  let sql: string;
  if (keywordId) {
    // Look up keyword text + device + location from Postgres so we can query ClickHouse
    // (rank_history stores keyword text, not IDs)
    const [kw] = await db
      .select()
      .from(trackedKeywords)
      .where(eq(trackedKeywords.id, keywordId))
      .limit(1);
    if (!kw) return c.json({ history: [] });

    sql = `
      SELECT keyword, position, previous_position, url, device, checked_at, serp_features
      FROM rank_history
      WHERE project_id = '${escapeSql(projectId)}'
        AND keyword = '${escapeSql(kw.keyword)}'
        AND device = '${escapeSql(kw.device)}'
        AND location_code = ${parseInt(kw.locationCode, 10)}
        AND checked_at >= now() - INTERVAL ${daysNum} DAY
      ORDER BY checked_at ASC
    `;
  } else {
    sql = `
      SELECT keyword,
             argMax(position, checked_at)  AS current_position,
             min(position)                 AS best_position,
             max(position)                 AS worst_position,
             count()                       AS data_points,
             max(checked_at)              AS last_checked
      FROM rank_history
      WHERE project_id = '${escapeSql(projectId)}'
        AND checked_at >= now() - INTERVAL ${daysNum} DAY
      GROUP BY keyword
      ORDER BY current_position ASC
    `;
  }

  try {
    const rows = await clickhouse.query(sql);
    return c.json({ history: rows });
  } catch (err) {
    console.error("[rank/history] ClickHouse error:", err instanceof Error ? err.message : err);
    return c.json({ history: [] });
  }
});

// ── /visibility ───────────────────────────────────────────────────────────────

router.get("/projects/:projectId/visibility", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  try {
    const rows = await clickhouse.query<{ date: string; visibility_score: number; estimated_traffic: number }>(
      `SELECT
         toDate(checked_at)                                              AS date,
         round(
           (  countIf(position <= 3)  * 1.0
            + countIf(position > 3  AND position <= 10) * 0.5
            + countIf(position > 10 AND position <= 20) * 0.2
           ) / count() * 100
         , 1)                                                            AS visibility_score,
         countIf(position <= 100)                                        AS estimated_traffic
       FROM rank_history
       WHERE project_id = '${escapeSql(projectId)}'
         AND checked_at >= now() - INTERVAL 90 DAY
       GROUP BY date
       ORDER BY date DESC
       LIMIT 90`
    );
    return c.json({ visibility: rows });
  } catch (err) {
    console.error("[rank/visibility] ClickHouse error:", err instanceof Error ? err.message : err);
    return c.json({ visibility: [] });
  }
});

// ── /check-now ────────────────────────────────────────────────────────────────
// Returns 202 immediately and runs rank checks in background without BullMQ,
// which requires Redis 5+. The current Windows dev Redis is 3.x.

router.post(
  "/projects/:projectId/check-now",
  zValidator("json", z.object({ keywordIds: z.array(z.string()).optional() })),
  async (c) => {
    const orgId = c.get("orgId");
    const db = getDb();
    const { projectId } = c.req.param();
    const { keywordIds } = c.req.valid("json");

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
    });
    if (!project) return c.json({ error: "Project not found" }, 404);

    let kws;
    if (keywordIds?.length) {
      kws = await db
        .select()
        .from(trackedKeywords)
        .where(and(eq(trackedKeywords.projectId, projectId), inArray(trackedKeywords.id, keywordIds)));
    } else {
      kws = await db
        .select()
        .from(trackedKeywords)
        .where(and(eq(trackedKeywords.projectId, projectId), eq(trackedKeywords.isActive, true)));
    }

    if (kws.length === 0) return c.json({ queued: 0, message: "No keywords to check" });

    void runRankChecksBackground(
      projectId,
      project.domain,
      kws.map((kw) => ({ id: kw.id, keyword: kw.keyword, locationCode: kw.locationCode, device: kw.device }))
    );

    return c.json({ queued: kws.length, message: `Checking ${kws.length} keywords in background` }, 202);
  }
);

// ── /tracked-with-positions ───────────────────────────────────────────────────
// rank_history stores keyword TEXT (not IDs). Join is done by matching
// (keyword, device, location_code) tuples between Postgres and ClickHouse.

router.get("/projects/:projectId/tracked-with-positions", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const kws = await db
    .select()
    .from(trackedKeywords)
    .where(and(eq(trackedKeywords.projectId, projectId), eq(trackedKeywords.isActive, true)));

  if (kws.length === 0) return c.json({ keywords: [] });

  // Unique keyword texts for the IN clause
  const kwTextList = [...new Set(kws.map((k) => k.keyword))].map((kw) => `'${escapeSql(kw)}'`).join(",");

  type PosRow = {
    keyword: string;
    device: string;
    location_code: number;
    current_position: number;
    previous_position: number;
    url: string;
    serp_features: unknown;
    last_checked: string;
    best_position: number;
  };

  try {
    const positions = await clickhouse.query<PosRow>(`
      SELECT
        keyword,
        device,
        location_code,
        argMax(position, checked_at)          AS current_position,
        argMax(previous_position, checked_at) AS previous_position,
        argMax(url, checked_at)               AS url,
        argMax(serp_features, checked_at)     AS serp_features,
        max(checked_at)                       AS last_checked,
        min(position)                         AS best_position
      FROM rank_history
      WHERE project_id = '${escapeSql(projectId)}'
        AND keyword IN (${kwTextList})
        AND checked_at >= now() - INTERVAL 90 DAY
      GROUP BY keyword, device, location_code
    `);

    // Key by "keyword::device::locationCode" to match tracked_keywords tuples
    const posMap = new Map(
      positions.map((p) => [`${p.keyword}::${p.device}::${p.location_code}`, p])
    );

    const keywords = kws.map((kw) => {
      const key = `${kw.keyword}::${kw.device}::${parseInt(kw.locationCode, 10)}`;
      const pos = posMap.get(key);
      return {
        id: kw.id,
        keyword: kw.keyword,
        locationCode: kw.locationCode,
        languageCode: kw.languageCode,
        device: kw.device,
        currentPosition: pos?.current_position ?? null,
        previousPosition: pos?.previous_position ?? null,
        change: pos != null ? (pos.previous_position ?? 0) - pos.current_position : null,
        bestPosition: pos?.best_position ?? null,
        url: pos?.url ?? null,
        serpFeatures: pos ? toSerpArray(pos.serp_features) : [],
        lastCheckedAt: pos?.last_checked ?? null,
        hasData: pos != null,
      };
    });

    return c.json({ keywords });
  } catch (err) {
    console.error("[rank/tracked-with-positions] error:", err instanceof Error ? err.message : err);
    return c.json({
      keywords: kws.map((kw) => ({
        id: kw.id,
        keyword: kw.keyword,
        locationCode: kw.locationCode,
        languageCode: kw.languageCode,
        device: kw.device,
        currentPosition: null,
        previousPosition: null,
        change: null,
        bestPosition: null,
        url: null,
        serpFeatures: [],
        lastCheckedAt: null,
        hasData: false,
      })),
    });
  }
});

// ── /metrics ──────────────────────────────────────────────────────────────────

router.get("/projects/:projectId/metrics", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const kws = await db
    .select({ id: trackedKeywords.id })
    .from(trackedKeywords)
    .where(and(eq(trackedKeywords.projectId, projectId), eq(trackedKeywords.isActive, true)));

  const totalTracked = kws.length;

  if (totalTracked === 0) {
    return c.json({ totalTracked: 0, top3: 0, top10: 0, top100: 0, avgPosition: null, visibilityScore: 0, hasData: false });
  }

  try {
    const rows = await clickhouse.query<{
      top3: number;
      top10: number;
      top100: number;
      avg_position: number;
      visibility_score: number;
    }>(`
      SELECT
        countIf(position <= 3)                                              AS top3,
        countIf(position <= 10)                                             AS top10,
        countIf(position <= 100)                                            AS top100,
        round(avg(position), 1)                                             AS avg_position,
        round(
          (  countIf(position <= 3)  * 1.0
           + countIf(position > 3  AND position <= 10) * 0.5
           + countIf(position > 10 AND position <= 20) * 0.2
          ) / count() * 100
        , 1)                                                                AS visibility_score
      FROM (
        SELECT keyword, device, argMax(position, checked_at) AS position
        FROM rank_history
        WHERE project_id = '${escapeSql(projectId)}'
          AND checked_at >= now() - INTERVAL 7 DAY
        GROUP BY keyword, device
      )
    `);

    const m = rows[0];
    return c.json({
      totalTracked,
      top3: m?.top3 ?? 0,
      top10: m?.top10 ?? 0,
      top100: m?.top100 ?? 0,
      avgPosition: m?.avg_position ?? null,
      visibilityScore: m?.visibility_score ?? 0,
      hasData: rows.length > 0,
    });
  } catch (err) {
    console.error("[rank/metrics] error:", err instanceof Error ? err.message : err);
    return c.json({ totalTracked, top3: 0, top10: 0, top100: 0, avgPosition: null, visibilityScore: 0, hasData: false });
  }
});

export default router;

// ── Background rank check ─────────────────────────────────────────────────────

const KNOWN_SERP_FEATURES = new Set([
  "featured_snippet", "people_also_ask", "video", "images",
  "local_pack", "sitelinks", "ai_overview",
]);

async function runRankChecksBackground(
  projectId: string,
  domain: string,
  kws: Array<{ id: string; keyword: string; locationCode: string; device: string }>
): Promise<void> {
  const login = process.env["DATAFORSEO_LOGIN"];
  const password = process.env["DATAFORSEO_PASSWORD"];
  if (!login || !password) {
    console.warn("[rank/check-now] DataForSEO credentials not configured — skipping");
    return;
  }

  const dfs = new DataForSEO({ login, password });
  const normDomain = (d: string) => d.replace(/^www\./, "").toLowerCase();
  const targetDomain = normDomain(domain);
  const CONCURRENCY = 5;

  const processKw = async (kw: (typeof kws)[number]): Promise<void> => {
    try {
      const locationCode = parseInt(kw.locationCode, 10);
      const device = kw.device as "desktop" | "mobile";

      const result = await dfs.serp.getOrganicResults(kw.keyword, locationCode, "en", device, 100, 90_000);

      const items = result.items as unknown as Array<{
        type: string;
        rank_absolute?: number;
        domain?: string;
        url?: string;
      }>;

      const match = items.find(
        (it) => it.type === "organic" && it.domain && normDomain(it.domain) === targetDomain
      );

      // Get current position to use as previous_position in the new row
      let prevPosition = 0;
      try {
        const prevRows = await clickhouse.query<{ pos: number }>(`
          SELECT argMax(position, checked_at) AS pos
          FROM rank_history
          WHERE project_id = '${escapeSql(projectId)}'
            AND keyword = '${escapeSql(kw.keyword)}'
            AND device = '${escapeSql(kw.device)}'
            AND checked_at >= now() - INTERVAL 30 DAY
        `);
        prevPosition = prevRows[0]?.pos ?? 0;
      } catch {
        prevPosition = 0;
      }

      const position = match?.rank_absolute ?? 101;
      const url = match?.url ?? "";
      const serpFeatures = result.item_types.filter((t) => KNOWN_SERP_FEATURES.has(t));

      await clickhouse.insert("rank_history", [{
        project_id: projectId,
        keyword: kw.keyword,
        position,
        previous_position: prevPosition,
        url,
        serp_features: serpFeatures,
        location_code: locationCode,
        device: kw.device,
        checked_at: new Date().toISOString(),
      }]);

      console.log(`[rank/check-now] "${kw.keyword}" (${kw.device}) → #${position}`);
    } catch (err) {
      console.error(`[rank/check-now] failed for "${kw.keyword}":`, err instanceof Error ? err.message : err);
    }
  };

  for (let i = 0; i < kws.length; i += CONCURRENCY) {
    await Promise.allSettled(kws.slice(i, i + CONCURRENCY).map(processKw));
  }

  console.log(`[rank/check-now] completed ${kws.length} checks for project ${projectId}`);
}
