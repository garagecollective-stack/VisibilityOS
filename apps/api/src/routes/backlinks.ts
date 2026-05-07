import "../types.js";
import { Hono } from "hono";
import { getDb } from "../lib/db/index.js";
import { backlinkSnapshots, projects } from "@garage-seo/db";
import { eq, and, desc } from "drizzle-orm";
import { createId } from "@garage-seo/db";
import { DataForSEO } from "@garage-seo/dataforseo";
import { getRedis, makeCacheAdapter } from "../lib/redis/index.js";

const router = new Hono();

function getDFS() {
  const redis = getRedis();
  return new DataForSEO({
    login: process.env["DATAFORSEO_LOGIN"]!,
    password: process.env["DATAFORSEO_PASSWORD"]!,
    cache: makeCacheAdapter(redis),
  });
}

router.get("/projects/:projectId/summary", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const dfs = getDFS();
  const summary = await dfs.backlinks.getDomainSummary(project.domain);

  if (summary) {
    await db.insert(backlinkSnapshots).values({
      id: createId(),
      projectId,
      totalBacklinks: summary.backlinks,
      referringDomains: summary.referring_domains,
      domainRank: summary.rank,
      newBacklinks: 0,
      lostBacklinks: 0,
    });
  }

  return c.json({ summary });
});

router.get("/projects/:projectId/backlinks", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();
  const { limit = "100", offset = "0" } = c.req.query();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const dfs = getDFS();
  const backlinks = await dfs.backlinks.getBacklinks(
    project.domain,
    parseInt(limit, 10),
    parseInt(offset, 10)
  );

  return c.json({ backlinks });
});

router.get("/projects/:projectId/history", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const snapshots = await db
    .select()
    .from(backlinkSnapshots)
    .where(eq(backlinkSnapshots.projectId, projectId))
    .orderBy(desc(backlinkSnapshots.checkedAt))
    .limit(90);

  return c.json({ snapshots });
});

export default router;
