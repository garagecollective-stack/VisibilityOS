import "../types.js";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../lib/db/index.js";
import { geoPrompts, geoResults, projects } from "@garage-seo/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { createId } from "@garage-seo/db";
import { geoChecksQueue } from "@garage-seo/workers";

const router = new Hono();

router.get("/projects/:projectId/prompts", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const prompts = await db
    .select()
    .from(geoPrompts)
    .where(eq(geoPrompts.projectId, projectId))
    .orderBy(desc(geoPrompts.createdAt));

  return c.json({ prompts });
});

router.post(
  "/projects/:projectId/prompts",
  zValidator(
    "json",
    z.object({
      promptText: z.string().min(10).max(500),
      platforms: z
        .array(z.enum(["chatgpt", "perplexity", "gemini", "google_aio"]))
        .default(["chatgpt", "perplexity", "gemini"]),
    })
  ),
  async (c) => {
    const orgId = c.get("orgId");
    const db = getDb();
    const { projectId } = c.req.param();
    const { promptText, platforms } = c.req.valid("json");

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
    });
    if (!project) return c.json({ error: "Project not found" }, 404);

    const [prompt] = await db
      .insert(geoPrompts)
      .values({ id: createId(), projectId, promptText, platforms })
      .returning();

    return c.json({ prompt }, 201);
  }
);

router.post("/projects/:projectId/prompts/:promptId/check", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId, promptId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const prompt = await db.query.geoPrompts.findFirst({
    where: and(eq(geoPrompts.id, promptId), eq(geoPrompts.projectId, projectId)),
  });
  if (!prompt) return c.json({ error: "Prompt not found" }, 404);

  await geoChecksQueue.add("geo-check", {
    promptId,
    projectId,
    promptText: prompt.promptText,
    platforms: prompt.platforms,
    targetDomain: project.domain,
  });

  return c.json({ message: "GEO check queued", promptId }, 202);
});

router.get("/projects/:projectId/results", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const prompts = await db
    .select({ id: geoPrompts.id })
    .from(geoPrompts)
    .where(eq(geoPrompts.projectId, projectId));

  if (prompts.length === 0) return c.json({ results: [] });

  const promptIds = prompts.map((p) => p.id);

  const results = await db
    .select()
    .from(geoResults)
    .where(inArray(geoResults.promptId, promptIds))
    .orderBy(desc(geoResults.checkedAt))
    .limit(200);

  return c.json({ results });
});

export default router;
