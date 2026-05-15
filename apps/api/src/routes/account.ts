import "../types.js";
import { Hono } from "hono";
import { getDb } from "../lib/db/index.js";
import { projects, trackedKeywords, auditRuns } from "@garage-seo/db";
import { eq, count, inArray, gte, and } from "drizzle-orm";

const router = new Hono();

// ─── GET /api/account/integrations ────────────────────────────────────────────

router.get("/integrations", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();

  const orgProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      gscConnected: projects.gscConnected,
      gscConnectedEmail: projects.gscConnectedEmail,
      gscLastSyncedAt: projects.gscLastSyncedAt,
      ga4Connected: projects.ga4Connected,
    })
    .from(projects)
    .where(eq(projects.orgId, orgId));

  const gscConnected = orgProjects.some((p) => p.gscConnected);
  const ga4Connected = orgProjects.some((p) => p.ga4Connected);

  const dataForSEOConfigured = !!(
    process.env["DATAFORSEO_LOGIN"] && process.env["DATAFORSEO_PASSWORD"]
  );
  const anthropicConfigured = !!process.env["ANTHROPIC_API_KEY"];

  return c.json({
    gsc: {
      connected: gscConnected,
      projects: orgProjects.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.gscConnected,
        email: p.gscConnectedEmail ?? null,
        lastSyncedAt: p.gscLastSyncedAt ?? null,
      })),
    },
    ga4: { connected: ga4Connected },
    googleAds: { connected: false },
    dataForSEO: { configured: dataForSEOConfigured },
    anthropic: { configured: anthropicConfigured },
  });
});

// ─── GET /api/account/usage ───────────────────────────────────────────────────

router.get("/usage", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();

  const orgProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.orgId, orgId));

  const projectsCount = orgProjects.length;
  const projectIds = orgProjects.map((p) => p.id);

  let keywordsCount = 0;
  let auditsThisMonth = 0;

  if (projectIds.length > 0) {
    const [kwRow] = await db
      .select({ count: count() })
      .from(trackedKeywords)
      .where(inArray(trackedKeywords.projectId, projectIds));

    keywordsCount = kwRow?.count ?? 0;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [auditRow] = await db
      .select({ count: count() })
      .from(auditRuns)
      .where(
        and(
          inArray(auditRuns.projectId, projectIds),
          gte(auditRuns.startedAt, monthStart)
        )
      );

    auditsThisMonth = auditRow?.count ?? 0;
  }

  return c.json({ projectsCount, keywordsCount, auditsThisMonth });
});

export default router;
