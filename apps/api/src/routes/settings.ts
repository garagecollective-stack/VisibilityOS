import "../types.js";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../lib/db/index.js";
import { projects, organizations } from "@garage-seo/db";
import { eq, and } from "drizzle-orm";

const router = new Hono();

// ─── Project Settings ─────────────────────────────────────────────────────────

router.get("/projects/:projectId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, c.req.param("projectId")), eq(projects.orgId, orgId)),
  });

  if (!project) return c.json({ error: "Project not found" }, 404);
  return c.json({ project });
});

const domainSchema = z
  .string()
  .min(3)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/, "Invalid domain — remove https:// and trailing slashes");

const projectSettingsPatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  domain: domainSchema.optional(),
  countryCode: z.string().length(2).optional(),
  languageCode: z.string().min(2).max(5).optional(),
  settings: z
    .object({
      maxPagesToCrawl: z.number().int().min(1).max(9999).optional(),
      crawlFrequency: z.enum(["daily", "weekly", "monthly", "manual"]).optional(),
      userAgent: z.enum(["visibilityos", "googlebot", "default"]).optional(),
      respectRobots: z.boolean().optional(),
      notificationsEnabled: z.boolean().optional(),
      notifyOn: z
        .object({
          criticalIssues: z.boolean().optional(),
          rankDrops: z.boolean().optional(),
          newBacklinks: z.boolean().optional(),
          gscSync: z.boolean().optional(),
          reportGenerated: z.boolean().optional(),
        })
        .optional(),
      notificationEmail: z.string().optional(),
    })
    .optional(),
});

router.patch("/projects/:projectId", zValidator("json", projectSettingsPatchSchema), async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, c.req.param("projectId")), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const { settings: settingsPatch, ...coreFields } = c.req.valid("json");

  const existingSettings = (project.settings as Record<string, unknown>) ?? {};
  const mergedSettings = settingsPatch
    ? { ...existingSettings, ...settingsPatch }
    : existingSettings;

  const [updated] = await db
    .update(projects)
    .set({ ...coreFields, settings: mergedSettings, updatedAt: new Date() })
    .where(and(eq(projects.id, c.req.param("projectId")), eq(projects.orgId, orgId)))
    .returning();

  return c.json({ project: updated });
});

// ─── Organization Settings ────────────────────────────────────────────────────

router.get("/organization", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) return c.json({ error: "Organization not found" }, 404);
  return c.json({ org });
});

const orgSettingsPatchSchema = z.object({
  settings: z
    .object({
      website: z.string().optional(),
      industry: z.string().optional(),
      teamSize: z.string().optional(),
      defaultCountry: z.string().optional(),
      defaultCrawlFrequency: z.string().optional(),
      defaultMaxPages: z.number().int().min(1).max(9999).optional(),
      weeklyDigest: z.boolean().optional(),
      monthlyReport: z.boolean().optional(),
      productUpdates: z.boolean().optional(),
      notificationEmail: z.string().optional(),
    })
    .optional(),
});

router.patch("/organization", zValidator("json", orgSettingsPatchSchema), async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) return c.json({ error: "Organization not found" }, 404);

  const { settings: settingsPatch } = c.req.valid("json");
  if (!settingsPatch) return c.json({ org });

  const existingSettings = (org.settings as Record<string, unknown>) ?? {};
  const mergedSettings = { ...existingSettings, ...settingsPatch };

  const [updated] = await db
    .update(organizations)
    .set({ settings: mergedSettings, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
    .returning();

  return c.json({ org: updated });
});

export default router;
