import "../types.js";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../lib/db/index.js";
import { auditRuns, auditIssues, projects } from "@garage-seo/db";
import { eq, and, desc } from "drizzle-orm";
import { createId } from "@garage-seo/db";
import { auditsQueue } from "@garage-seo/workers";

const router = new Hono();

router.get("/projects/:projectId/runs", async (c) => {
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

router.get("/runs/:runId/issues", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { runId } = c.req.param();
  const { severity, category } = c.req.query();

  const run = await db.query.auditRuns.findFirst({
    where: eq(auditRuns.id, runId),
    with: { project: true },
  });
  if (!run || run.project.orgId !== orgId) {
    return c.json({ error: "Audit run not found" }, 404);
  }

  const conditions = [eq(auditIssues.runId, runId)];

  if (severity) {
    conditions.push(eq(auditIssues.severity, severity as "critical" | "warning" | "notice"));
  }
  if (category) {
    conditions.push(
      eq(
        auditIssues.category,
        category as "meta" | "links" | "speed" | "content" | "schema" | "mobile" | "security" | "indexing" | "cwv"
      )
    );
  }

  const issues = await db
    .select()
    .from(auditIssues)
    .where(and(...conditions))
    .orderBy(auditIssues.severity, auditIssues.category)
    .limit(500);

  return c.json({ issues, run });
});

router.post(
  "/projects/:projectId/start",
  zValidator(
    "json",
    z.object({
      maxPages: z.number().int().min(50).max(10_000).default(500),
    })
  ),
  async (c) => {
    const orgId = c.get("orgId");
    const db = getDb();
    const { projectId } = c.req.param();
    const { maxPages } = c.req.valid("json");

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
      return c.json({ error: "An audit is already running for this project", runId: running.id }, 409);
    }

    const [run] = await db
      .insert(auditRuns)
      .values({ id: createId(), projectId, status: "pending" })
      .returning();

    await auditsQueue.add("audit", {
      projectId,
      auditRunId: run!.id,
      domain: project.domain,
      maxPages,
    });

    return c.json({ run }, 202);
  }
);

export default router;
