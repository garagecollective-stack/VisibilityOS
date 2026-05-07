import "../types.js";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../lib/db/index.js";
import { projects } from "@garage-seo/db";
import { eq, and } from "drizzle-orm";
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

router.get("/projects/:projectId/overview", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();
  const { locationCode = "2356" } = c.req.query();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const dfs = getDFS();
  const [domainMetrics, competitors] = await Promise.all([
    dfs.labs.getDomainMetrics(project.domain, parseInt(locationCode, 10)),
    dfs.labs.getCompetitorDomains(project.domain, parseInt(locationCode, 10), 10),
  ]);

  return c.json({ domain: project.domain, metrics: domainMetrics, competitors });
});

router.post(
  "/projects/:projectId/compare",
  zValidator(
    "json",
    z.object({
      domains: z.array(z.string()).min(1).max(5),
      locationCode: z.number().int().positive().default(2356),
    })
  ),
  async (c) => {
    const orgId = c.get("orgId");
    const db = getDb();
    const { projectId } = c.req.param();
    const { domains, locationCode } = c.req.valid("json");

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
    });
    if (!project) return c.json({ error: "Project not found" }, 404);

    const dfs = getDFS();
    const allDomains = [project.domain, ...domains];
    const metrics = await dfs.labs.getBulkDomainMetrics(allDomains, locationCode);

    return c.json({ comparison: metrics });
  }
);

export default router;
