import "../types.js";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../lib/db/index.js";
import { projects, organizations } from "@garage-seo/db";
import { eq, and } from "drizzle-orm";
import { createId } from "@garage-seo/db";
import { enforcePlanLimit } from "../middleware/planLimits.js";

const router = new Hono();

const createProjectSchema = z.object({
  domain: z.string().min(3).regex(/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/),
  name: z.string().min(1).max(100),
  countryCode: z.string().length(2).default("IN"),
  languageCode: z.string().min(2).max(5).default("en"),
});

const updateProjectSchema = createProjectSchema.partial().extend({
  settings: z
    .object({
      competitors: z.array(z.string()).max(10).optional(),
      alertsEnabled: z.boolean().optional(),
      rankDropThreshold: z.number().min(1).max(50).optional(),
      crawlFrequency: z.enum(["daily", "weekly", "monthly"]).optional(),
    })
    .optional(),
});

router.get("/", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();

  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.orgId, orgId))
    .orderBy(projects.createdAt);

  return c.json({ projects: rows });
});

router.get("/:id", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, c.req.param("id")), eq(projects.orgId, orgId)),
  });

  if (!project) return c.json({ error: "Project not found" }, 404);
  return c.json({ project });
});

router.post(
  "/",
  enforcePlanLimit("projects"),
  zValidator("json", createProjectSchema),
  async (c) => {
    const orgId = c.get("orgId");
    const body = c.req.valid("json");
    const db = getDb();

    console.log(`[projects:post] orgId="${orgId}" domain="${body.domain}" name="${body.name}"`);

    // planLimits already upserted the org, but guard again in case this route
    // is ever called without the middleware.
    await db
      .insert(organizations)
      .values({ id: orgId, name: orgId, slug: orgId, plan: "starter" })
      .onConflictDoNothing();

    try {
      const [project] = await db
        .insert(projects)
        .values({ id: createId(), orgId, ...body })
        .returning();

      console.log(`[projects:post] project created: id="${project!.id}"`);
      return c.json({ project }, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[projects:post] insert failed for orgId="${orgId}":`, msg);
      return c.json({ error: "Failed to create project", detail: msg }, 500);
    }
  }
);

router.patch("/:id", zValidator("json", updateProjectSchema), async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();

  const existing = await db.query.projects.findFirst({
    where: and(eq(projects.id, c.req.param("id")), eq(projects.orgId, orgId)),
  });
  if (!existing) return c.json({ error: "Project not found" }, 404);

  const body = c.req.valid("json");
  const [updated] = await db
    .update(projects)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(projects.id, c.req.param("id")))
    .returning();

  return c.json({ project: updated });
});

router.delete("/:id", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();

  const existing = await db.query.projects.findFirst({
    where: and(eq(projects.id, c.req.param("id")), eq(projects.orgId, orgId)),
  });
  if (!existing) return c.json({ error: "Project not found" }, 404);

  await db.delete(projects).where(eq(projects.id, c.req.param("id")));
  return c.json({ success: true });
});

export default router;
