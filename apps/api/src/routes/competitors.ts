import "../types.js";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../lib/db/index.js";
import { projects, trackedKeywords, competitors } from "@garage-seo/db";
import { eq, and } from "drizzle-orm";
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

function hasCreds(): boolean {
  return !!(process.env["DATAFORSEO_LOGIN"] && process.env["DATAFORSEO_PASSWORD"]);
}

const MOCK_COMPETITORS = [
  { domain: "semrush.com", sharedKeywords: 245, traffic: 125000, avgPosition: 8.2 },
  { domain: "ahrefs.com", sharedKeywords: 189, traffic: 98000, avgPosition: 9.1 },
  { domain: "moz.com", sharedKeywords: 134, traffic: 67000, avgPosition: 11.4 },
  { domain: "ubersuggest.com", sharedKeywords: 98, traffic: 45000, avgPosition: 14.2 },
  { domain: "serpstat.com", sharedKeywords: 76, traffic: 32000, avgPosition: 16.8 },
];

const MOCK_GAP_KEYWORDS = [
  { keyword: "seo audit tool", competitorPosition: 2, volume: 8100, kd: 58, cpc: 12.4, intent: "Commercial" },
  { keyword: "keyword research free", competitorPosition: 3, volume: 6600, kd: 45, cpc: 7.2, intent: "Informational" },
  { keyword: "backlink checker", competitorPosition: 1, volume: 5400, kd: 62, cpc: 9.8, intent: "Commercial" },
  { keyword: "rank tracking software", competitorPosition: 5, volume: 3600, kd: 38, cpc: 15.1, intent: "Commercial" },
  { keyword: "on page seo checker", competitorPosition: 4, volume: 2900, kd: 32, cpc: 6.5, intent: "Commercial" },
  { keyword: "competitor analysis seo", competitorPosition: 6, volume: 2400, kd: 41, cpc: 11.0, intent: "Commercial" },
  { keyword: "seo reporting tool", competitorPosition: 3, volume: 1900, kd: 29, cpc: 18.2, intent: "Commercial" },
  { keyword: "how to build backlinks", competitorPosition: 2, volume: 1600, kd: 35, cpc: 4.1, intent: "Informational" },
  { keyword: "local seo guide", competitorPosition: 7, volume: 1300, kd: 22, cpc: 3.8, intent: "Informational" },
  { keyword: "technical seo checklist", competitorPosition: 4, volume: 1100, kd: 28, cpc: 5.6, intent: "Informational" },
];

const MOCK_COMMON_KEYWORDS = [
  { keyword: "seo tools", yourPosition: 8, competitorPosition: 3, volume: 12100, kd: 72 },
  { keyword: "keyword tracker", yourPosition: 5, competitorPosition: 9, volume: 4400, kd: 55 },
  { keyword: "serp checker", yourPosition: 12, competitorPosition: 6, volume: 3600, kd: 48 },
  { keyword: "website seo analysis", yourPosition: 3, competitorPosition: 11, volume: 2900, kd: 44 },
  { keyword: "google rank checker", yourPosition: 7, competitorPosition: 7, volume: 2400, kd: 51 },
  { keyword: "seo monitoring", yourPosition: 4, competitorPosition: 15, volume: 1900, kd: 39 },
  { keyword: "domain authority checker", yourPosition: 14, competitorPosition: 5, volume: 1600, kd: 46 },
  { keyword: "page speed test", yourPosition: 9, competitorPosition: 2, volume: 1400, kd: 38 },
];

const MOCK_TOP_PAGES = [
  { url: "/blog/seo-audit-guide", traffic: 24500, keywords: 312, topKeyword: "seo audit", topPosition: 2 },
  { url: "/blog/keyword-research", traffic: 18900, keywords: 245, topKeyword: "keyword research guide", topPosition: 1 },
  { url: "/features/rank-tracker", traffic: 14200, keywords: 189, topKeyword: "rank tracker tool", topPosition: 3 },
  { url: "/blog/backlink-building", traffic: 11800, keywords: 156, topKeyword: "how to get backlinks", topPosition: 4 },
  { url: "/blog/technical-seo", traffic: 9600, keywords: 134, topKeyword: "technical seo guide", topPosition: 2 },
  { url: "/blog/on-page-seo", traffic: 7400, keywords: 98, topKeyword: "on page seo checklist", topPosition: 3 },
  { url: "/features/site-audit", traffic: 5900, keywords: 87, topKeyword: "website audit tool", topPosition: 5 },
  { url: "/blog/local-seo-tips", traffic: 4700, keywords: 76, topKeyword: "local seo strategies", topPosition: 6 },
];

// ─── LIST competitors for a project ───────────────────────────────────────────

router.get("/projects/:projectId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const rows = await db
    .select()
    .from(competitors)
    .where(and(eq(competitors.projectId, projectId), eq(competitors.orgId, orgId)));

  return c.json({ competitors: rows });
});

// ─── ADD a competitor ─────────────────────────────────────────────────────────

router.post(
  "/projects/:projectId/add",
  zValidator("json", z.object({ domain: z.string().min(1) })),
  async (c) => {
    const orgId = c.get("orgId");
    const db = getDb();
    const { projectId } = c.req.param();
    const { domain } = c.req.valid("json");

    const cleanDomain = domain
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .trim();

    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(cleanDomain)) {
      return c.json({ error: "Invalid domain format. Use example.com without http or paths." }, 400);
    }

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
    });
    if (!project) return c.json({ error: "Project not found" }, 404);

    const existing = await db
      .select()
      .from(competitors)
      .where(and(eq(competitors.projectId, projectId), eq(competitors.orgId, orgId)));

    if (existing.length >= 5) {
      return c.json({ error: "Maximum 5 competitors per project." }, 400);
    }

    if (existing.some((c) => c.domain === cleanDomain)) {
      return c.json({ error: "Competitor already added." }, 400);
    }

    let organicKeywords: number | null = null;
    let organicTraffic: number | null = null;
    let domainRank: number | null = null;

    if (hasCreds()) {
      try {
        const dfs = getDFS();
        const metrics = await dfs.labs.getDomainMetrics(cleanDomain, 2356);
        if (metrics) {
          organicKeywords = metrics.metrics.organic.count ?? null;
          organicTraffic = Math.round(metrics.metrics.organic.etv) ?? null;
        }
        const blSummary = await dfs.backlinks.getDomainSummary(cleanDomain);
        if (blSummary) {
          domainRank = blSummary.rank ?? null;
        }
      } catch {
        // Proceed without cached metrics
      }
    }

    const [competitor] = await db
      .insert(competitors)
      .values({
        id: createId(),
        projectId,
        orgId,
        domain: cleanDomain,
        organicKeywords,
        organicTraffic,
        domainRank,
        lastFetchedAt: hasCreds() ? new Date() : null,
      })
      .returning();

    return c.json({ competitor }, 201);
  }
);

// ─── DELETE a competitor ──────────────────────────────────────────────────────

router.delete("/projects/:projectId/:competitorId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId, competitorId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  await db
    .delete(competitors)
    .where(
      and(
        eq(competitors.id, competitorId),
        eq(competitors.projectId, projectId),
        eq(competitors.orgId, orgId)
      )
    );

  return c.json({ ok: true });
});

// ─── DISCOVER competitors ─────────────────────────────────────────────────────

router.post(
  "/projects/:projectId/discover",
  zValidator("json", z.object({ yourDomain: z.string().min(1) })),
  async (c) => {
    const orgId = c.get("orgId");
    const db = getDb();
    const { projectId } = c.req.param();
    const { yourDomain } = c.req.valid("json");

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
    });
    if (!project) return c.json({ error: "Project not found" }, 404);

    if (!hasCreds()) {
      return c.json({ competitors: MOCK_COMPETITORS, isMock: true });
    }

    try {
      const dfs = getDFS();
      const results = await dfs.labs.getCompetitorDomains(yourDomain, 2356, 10);
      const formatted = results.map((r) => ({
        domain: r.domain,
        sharedKeywords: r.intersections ?? 0,
        traffic: Math.round(r.full_domain_metrics?.metrics?.organic?.etv ?? 0),
        avgPosition: r.avg_position ?? 0,
      }));
      return c.json({ competitors: formatted, isMock: false });
    } catch {
      return c.json({ competitors: MOCK_COMPETITORS, isMock: true });
    }
  }
);

// ─── KEYWORD GAP ─────────────────────────────────────────────────────────────

router.get("/projects/:projectId/gap", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();
  const { competitorDomain = "", locationCode = "2356" } = c.req.query();

  if (!competitorDomain) return c.json({ error: "competitorDomain is required" }, 400);

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const redis = getRedis();
  const cacheKey = `gap:${projectId}:${competitorDomain}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return c.json(JSON.parse(cached));
  }

  if (!hasCreds()) {
    const resp = { keywords: MOCK_GAP_KEYWORDS, isMock: true };
    return c.json(resp);
  }

  try {
    const dfs = getDFS();
    const loc = parseInt(locationCode, 10);

    const [competitorKeywords, myTracked] = await Promise.all([
      dfs.labs.getKeywordsForSite(competitorDomain, loc, 100),
      db.select().from(trackedKeywords).where(eq(trackedKeywords.projectId, projectId)),
    ]);

    const myKeywordsSet = new Set(myTracked.map((k) => k.keyword.toLowerCase()));

    const gapKeywords = competitorKeywords
      .filter((item) => !myKeywordsSet.has(item.keyword.toLowerCase()))
      .map((item) => ({
        keyword: item.keyword,
        competitorPosition: item.ranked_serp_element?.serp_item?.rank_group ?? 0,
        volume: item.keyword_info?.search_volume ?? 0,
        kd: item.keyword_properties?.keyword_difficulty ?? null,
        cpc: item.keyword_info?.cpc ?? 0,
        intent: item.search_intent_info?.main_intent ?? "Commercial",
      }))
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));

    const resp = { keywords: gapKeywords, isMock: false };
    await redis.setex(cacheKey, 86_400, JSON.stringify(resp));
    return c.json(resp);
  } catch {
    const resp = { keywords: MOCK_GAP_KEYWORDS, isMock: true };
    return c.json(resp);
  }
});

// ─── COMMON KEYWORDS ──────────────────────────────────────────────────────────

router.get("/projects/:projectId/common", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();
  const { competitorDomain = "", locationCode = "2356" } = c.req.query();

  if (!competitorDomain) return c.json({ error: "competitorDomain is required" }, 400);

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const redis = getRedis();
  const cacheKey = `common:${projectId}:${competitorDomain}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return c.json(JSON.parse(cached));
  }

  if (!hasCreds()) {
    const withWinner = MOCK_COMMON_KEYWORDS.map((k) => ({
      ...k,
      winner:
        k.yourPosition < k.competitorPosition
          ? "you"
          : k.yourPosition > k.competitorPosition
            ? "competitor"
            : "tie",
    }));
    return c.json({ keywords: withWinner, isMock: true });
  }

  try {
    const dfs = getDFS();
    const loc = parseInt(locationCode, 10);

    const [myRanked, competitorKeywords] = await Promise.all([
      dfs.labs.getRankedKeywords(project.domain, loc, 100),
      dfs.labs.getKeywordsForSite(competitorDomain, loc, 100),
    ]);

    const competitorMap = new Map(
      competitorKeywords.map((item) => [
        item.keyword.toLowerCase(),
        item.ranked_serp_element?.serp_item?.rank_group ?? 99,
      ])
    );

    const common = myRanked
      .filter((item) => competitorMap.has(item.keyword_data.keyword.toLowerCase()))
      .map((item) => {
        const yourPos = item.ranked_serp_element?.serp_item?.rank_group ?? 99;
        const theirPos = competitorMap.get(item.keyword_data.keyword.toLowerCase()) ?? 99;
        return {
          keyword: item.keyword_data.keyword,
          yourPosition: yourPos,
          competitorPosition: theirPos,
          volume: item.keyword_data.keyword_info?.search_volume ?? 0,
          kd: item.keyword_data.keyword_properties?.keyword_difficulty ?? null,
          winner: yourPos < theirPos ? "you" : yourPos > theirPos ? "competitor" : "tie",
        };
      })
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .slice(0, 50);

    const resp = { keywords: common, isMock: false };
    await redis.setex(cacheKey, 86_400, JSON.stringify(resp));
    return c.json(resp);
  } catch {
    const withWinner = MOCK_COMMON_KEYWORDS.map((k) => ({
      ...k,
      winner:
        k.yourPosition < k.competitorPosition
          ? "you"
          : k.yourPosition > k.competitorPosition
            ? "competitor"
            : "tie",
    }));
    return c.json({ keywords: withWinner, isMock: true });
  }
});

// ─── TOP PAGES ────────────────────────────────────────────────────────────────

router.get("/projects/:projectId/top-pages", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();
  const { competitorDomain = "", locationCode = "2356" } = c.req.query();

  if (!competitorDomain) return c.json({ error: "competitorDomain is required" }, 400);

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const redis = getRedis();
  const cacheKey = `toppages:${competitorDomain}:${locationCode}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return c.json(JSON.parse(cached));
  }

  if (!hasCreds()) {
    return c.json({
      pages: MOCK_TOP_PAGES.map((p) => ({
        url: `https://${competitorDomain}${p.url}`,
        traffic: p.traffic,
        keywords: p.keywords,
        topKeyword: p.topKeyword,
        topPosition: p.topPosition,
      })),
      isMock: true,
    });
  }

  try {
    const dfs = getDFS();
    const loc = parseInt(locationCode, 10);
    const items = await dfs.labs.getTopPages(competitorDomain, loc, 20);

    const pages = items.map((item) => ({
      url: item.page_address,
      traffic: item.traffic ?? 0,
      keywords: item.keywords_count ?? 0,
      topKeyword: item.top_keyword ?? "",
      topPosition: item.top_position ?? 0,
    }));

    const resp = { pages, isMock: false };
    await redis.setex(cacheKey, 86_400, JSON.stringify(resp));
    return c.json(resp);
  } catch {
    return c.json({
      pages: MOCK_TOP_PAGES.map((p) => ({
        url: `https://${competitorDomain}${p.url}`,
        traffic: p.traffic,
        keywords: p.keywords,
        topKeyword: p.topKeyword,
        topPosition: p.topPosition,
      })),
      isMock: true,
    });
  }
});

// ─── BACKLINK COMPARISON ──────────────────────────────────────────────────────

router.get("/projects/:projectId/backlinks", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();
  const { competitorDomain = "" } = c.req.query();

  if (!competitorDomain) return c.json({ error: "competitorDomain is required" }, 400);

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  if (!hasCreds()) {
    return c.json({
      you: { domain: project.domain, referringDomains: 847, totalBacklinks: 12340, domainRank: 52, newBacklinks: 23, lostBacklinks: 8 },
      competitor: { domain: competitorDomain, referringDomains: 1243, totalBacklinks: 28900, domainRank: 67, newBacklinks: 41, lostBacklinks: 15 },
      isMock: true,
    });
  }

  try {
    const dfs = getDFS();
    const [mySummary, theirSummary] = await Promise.all([
      dfs.backlinks.getDomainSummary(project.domain),
      dfs.backlinks.getDomainSummary(competitorDomain),
    ]);

    return c.json({
      you: mySummary
        ? {
            domain: project.domain,
            referringDomains: mySummary.referring_domains,
            totalBacklinks: mySummary.backlinks,
            domainRank: mySummary.rank,
            newBacklinks: 0,
            lostBacklinks: 0,
          }
        : null,
      competitor: theirSummary
        ? {
            domain: competitorDomain,
            referringDomains: theirSummary.referring_domains,
            totalBacklinks: theirSummary.backlinks,
            domainRank: theirSummary.rank,
            newBacklinks: 0,
            lostBacklinks: 0,
          }
        : null,
      isMock: false,
    });
  } catch {
    return c.json({
      you: { domain: project.domain, referringDomains: 847, totalBacklinks: 12340, domainRank: 52, newBacklinks: 23, lostBacklinks: 8 },
      competitor: { domain: competitorDomain, referringDomains: 1243, totalBacklinks: 28900, domainRank: 67, newBacklinks: 41, lostBacklinks: 15 },
      isMock: true,
    });
  }
});

// ─── OVERVIEW (kept for backward compat) ─────────────────────────────────────

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
  const [domainMetrics, competitorSuggestions] = await Promise.all([
    dfs.labs.getDomainMetrics(project.domain, parseInt(locationCode, 10)),
    dfs.labs.getCompetitorDomains(project.domain, parseInt(locationCode, 10), 10),
  ]);

  return c.json({ domain: project.domain, metrics: domainMetrics, competitors: competitorSuggestions });
});

// ─── COMPARE (kept for backward compat) ──────────────────────────────────────

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
