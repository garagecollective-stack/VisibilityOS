import "../types.js";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../lib/db/index.js";
import { clickhouse } from "../lib/clickhouse/index.js";
import { projects, trackedKeywords } from "@garage-seo/db";
import { eq, and, inArray } from "drizzle-orm";
import { rankChecksQueue } from "@garage-seo/workers";

const router = new Hono();

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
    sql = `
      SELECT keyword_id, keyword, position, previous_position, url, device,
             checked_at, serp_features
      FROM rank_history
      WHERE project_id = '${projectId}'
        AND keyword_id = '${keywordId}'
        AND checked_at >= now() - INTERVAL ${daysNum} DAY
      ORDER BY checked_at ASC
    `;
  } else {
    sql = `
      SELECT keyword_id, keyword,
             argMax(position, checked_at) AS current_position,
             min(position) AS best_position,
             max(position) AS worst_position,
             count() AS data_points,
             max(checked_at) AS last_checked
      FROM rank_history
      WHERE project_id = '${projectId}'
        AND checked_at >= now() - INTERVAL ${daysNum} DAY
      GROUP BY keyword_id, keyword
      ORDER BY current_position ASC
    `;
  }

  const rows = await clickhouse.query(sql);
  return c.json({ history: rows });
});

router.get("/projects/:projectId/visibility", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const rows = await clickhouse.query<{ date: string; visibility_score: number; estimated_traffic: number }>(
    `SELECT date, visibility_score, estimated_traffic
     FROM traffic_estimates
     WHERE project_id = '${projectId}'
     ORDER BY date DESC
     LIMIT 90`
  );

  return c.json({ visibility: rows });
});

router.post(
  "/projects/:projectId/check-now",
  zValidator(
    "json",
    z.object({
      keywordIds: z.array(z.string()).optional(),
    })
  ),
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
        .where(
          and(
            eq(trackedKeywords.projectId, projectId),
            inArray(trackedKeywords.id, keywordIds)
          )
        );
    } else {
      kws = await db
        .select()
        .from(trackedKeywords)
        .where(
          and(
            eq(trackedKeywords.projectId, projectId),
            eq(trackedKeywords.isActive, true)
          )
        );
    }

    const jobs = await rankChecksQueue.addBulk(
      kws.map((kw) => ({
        name: "rank-check",
        data: {
          projectId,
          keywordId: kw.id,
          keyword: kw.keyword,
          locationCode: parseInt(kw.locationCode, 10),
          device: kw.device,
          domain: project.domain,
        },
      }))
    );

    return c.json({ queued: jobs.length, message: `Queued ${jobs.length} rank checks` });
  }
);

export default router;
