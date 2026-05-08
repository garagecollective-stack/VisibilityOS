import "../types.js";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../lib/db/index.js";
import { trackedKeywords, projects, keywordLists, keywordListItems } from "@garage-seo/db";
import { eq, and, inArray } from "drizzle-orm";
import { createId } from "@garage-seo/db";
import { DataForSEO } from "@garage-seo/dataforseo";
import { getRedis, makeCacheAdapter, CACHE_TTL } from "../lib/redis/index.js";
import { enforcePlanLimit } from "../middleware/planLimits.js";

const router = new Hono();

// ─── Schemas ───────────────────────────────────────────────────────────────────

const addKeywordsSchema = z.object({
  keywords: z.array(z.string().min(1).max(200)).min(1).max(100),
  locationCode: z.number().int().positive().default(2356),
  languageCode: z.string().default("en"),
  device: z.enum(["desktop", "mobile"]).default("desktop"),
});

const researchSchema = z.object({
  keyword: z.string().min(1),
  locationCode: z.number().int().positive().default(2356),
  languageCode: z.string().default("en"),
  type: z.enum(["suggestions", "ideas", "volume"]).default("suggestions"),
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getDataForSEO() {
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

type Intent = "Transactional" | "Informational" | "Navigational" | "Commercial";

function classifyIntent(keyword: string): Intent {
  const kw = keyword.toLowerCase();
  if (/\b(buy|price|cheap|deal|discount|shop|order|purchase|coupon|promo|cost|quote)\b/.test(kw))
    return "Transactional";
  if (/\b(how to|what is|what are|guide|tutorial|tips|learn|explain|definition|why|when|who|meaning)\b/.test(kw))
    return "Informational";
  if (/\b(login|sign in|website|official|download|app|portal|account|homepage)\b/.test(kw))
    return "Navigational";
  if (/\b(best|top|review|compare|comparison|vs|alternative|alternatives|ranking|rated|worth|should i|agency|agencies|service|services|company|companies|hire|consultant|consultants|firm|firms)\b/.test(kw))
    return "Commercial";
  return "Commercial";
}

function normalizeLocationCode(locationCode: number | undefined): number {
  if (!locationCode || locationCode <= 0) return 2840;
  return locationCode;
}

function toKeywordRow(item: {
  keyword: string;
  search_volume?: number | null;
  cpc?: number | null;
  keyword_difficulty?: number | null;
  monthly_searches?: Array<{ year: number; month: number; search_volume: number }> | null;
  competition?: number | null;
}) {
  return {
    keyword: item.keyword,
    search_volume: item.search_volume ?? 0,
    cpc: item.cpc ?? 0,
    keyword_difficulty: item.keyword_difficulty ?? null,
    intent: classifyIntent(item.keyword),
    monthly_searches: item.monthly_searches ?? [],
    competition: item.competition ?? null,
  };
}

// ─── Mock data (used when DataForSEO credentials are absent) ──────────────────

function makeMockOverview(keyword: string) {
  const now = new Date();
  const monthly_searches = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      search_volume: Math.floor(800 + Math.random() * 8000),
    };
  });
  const main = {
    keyword,
    search_volume: 12100,
    cpc: 4.5,
    keyword_difficulty: 42,
    intent: classifyIntent(keyword),
    monthly_searches,
  };
  const seeds = [
    "tools", "software", "checker", "analyzer", "guide", "tips",
    "best", "free", "online", "tutorial", "examples", "strategy",
    "course", "platform", "agency", "services", "cost", "audit",
    "report", "ranking",
  ];
  const related = seeds.map((suffix, i) => {
    const kw = `${keyword} ${suffix}`;
    return {
      keyword: kw,
      search_volume: Math.floor(200 + Math.random() * 12000),
      cpc: Math.round(Math.random() * 20 * 100) / 100,
      keyword_difficulty: Math.floor(Math.random() * 100),
      intent: classifyIntent(kw),
      monthly_searches: Array.from({ length: 12 }, (_, j) => ({
        year: now.getFullYear(),
        month: ((now.getMonth() + j) % 12) + 1,
        search_volume: Math.floor(100 + Math.random() * 5000),
      })),
    };
  });
  return { main, related };
}

function makeMockIdeas(keyword: string) {
  const suffixes = [
    "guide", "tips", "tools", "best", "software", "checker", "analyzer", "free", "tutorial",
    "examples", "strategy", "course", "book", "meaning", "definition", "template", "checklist",
    "audit", "report", "analysis", "platform", "agency", "services", "vs", "alternative",
    "comparison", "review", "ranking", "list", "pricing",
  ];
  return suffixes.map((suffix) => {
    const kw = `${keyword} ${suffix}`;
    return {
      keyword: kw,
      search_volume: Math.floor(100 + Math.random() * 15000),
      cpc: Math.round(Math.random() * 20 * 100) / 100,
      keyword_difficulty: Math.floor(Math.random() * 100),
      intent: classifyIntent(kw),
    };
  });
}

function clusterSupportingKeywords(keywords: Array<ReturnType<typeof toKeywordRow>>) {
  const groups = new Map<string, Array<ReturnType<typeof toKeywordRow>>>();

  for (const keyword of keywords) {
    const parts = keyword.keyword.split(/\s+/);
    const subtopic = parts.slice(0, 2).join(" ") || "General";
    const bucket = groups.get(subtopic) ?? [];
    bucket.push(keyword);
    groups.set(subtopic, bucket);
  }

  return Array.from(groups.entries())
    .slice(0, 6)
    .map(([subtopic, rows]) => ({
      subtopic,
      keywords: rows.slice(0, 4),
    }));
}

async function fetchKeywordIdeas(keyword: string, locationCode: number, languageCode: string) {
  const normalizedLocationCode = normalizeLocationCode(locationCode);

  if (!hasCreds()) {
    return { ideas: makeMockIdeas(keyword).map((idea) => toKeywordRow(idea)) };
  }

  const redis = getRedis();
  const cacheKey = `kw:${keyword}:${normalizedLocationCode}:${languageCode}:ideas`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as { ideas: Array<ReturnType<typeof toKeywordRow>> };

  const dfs = getDataForSEO();
  const raw = await dfs.keywords.getKeywordIdeas(keyword, normalizedLocationCode, languageCode);
  const result = {
    ideas: raw.map((idea) =>
      toKeywordRow({
        keyword: idea.keyword,
        search_volume: idea.search_volume,
        cpc: idea.cpc,
        keyword_difficulty: idea.keyword_difficulty ?? null,
        monthly_searches: idea.monthly_searches,
        competition: idea.competition,
      })
    ),
  };
  await redis.setex(cacheKey, CACHE_TTL.KEYWORD_DATA, JSON.stringify(result));
  return result;
}

// ─── Overview ─────────────────────────────────────────────────────────────────

router.post(
  "/overview",
  zValidator(
    "json",
    z.object({
      keyword: z.string().min(1).max(200),
      locationCode: z.number().int().positive().default(2356),
      languageCode: z.string().default("en"),
    })
  ),
  async (c) => {
    const { keyword, locationCode, languageCode } = c.req.valid("json");

    console.log(`[keywords/overview] keyword="${keyword}" hasCreds=${hasCreds()} login=${process.env["DATAFORSEO_LOGIN"] ? "set" : "missing"} password=${process.env["DATAFORSEO_PASSWORD"] ? "set" : "missing"}`);

    if (!hasCreds()) {
      console.log("[keywords/overview] No DataForSEO creds — returning mock data");
      return c.json(makeMockOverview(keyword));
    }

    try {
      const redis = getRedis();
      const cacheKey = `kw:${keyword}:${locationCode}:${languageCode}:overview`;
      // Cache temporarily bypassed for debugging — re-enable after confirming response shape
      // const cached = await redis.get(cacheKey);
      // if (cached) return c.json(JSON.parse(cached) as ReturnType<typeof makeMockOverview>);

      const dfs = getDataForSEO();
      let rawSuggestions: Awaited<ReturnType<typeof dfs.keywords.getSuggestions>> = [];
      try {
        rawSuggestions = await dfs.keywords.getSuggestions(keyword, locationCode, languageCode);
      } catch (suggestErr) {
        console.warn("[keywords/overview] suggestions fetch failed (non-fatal):", suggestErr instanceof Error ? suggestErr.message : suggestErr);
      }

      // Guard against items with missing keyword field
      const suggestions = rawSuggestions.filter((s) => typeof s?.keyword === "string");

      const kwLower = keyword.toLowerCase();
      const exactMatch = suggestions.find((s) => s.keyword.toLowerCase() === kwLower);
      const related = suggestions
        .filter((s) => s.keyword.toLowerCase() !== kwLower)
        .slice(0, 20)
        .map((s) => ({
          keyword: s.keyword,
          search_volume: s.search_volume ?? 0,
          cpc: s.cpc ?? 0,
          keyword_difficulty: s.keyword_difficulty ?? s.keyword_properties?.keyword_difficulty ?? null,
          intent: classifyIntent(s.keyword),
          monthly_searches: s.monthly_searches ?? [],
        }));

      let main;
      if (exactMatch) {
        main = {
          keyword: exactMatch.keyword,
          search_volume: exactMatch.search_volume ?? 0,
          cpc: exactMatch.cpc ?? 0,
          keyword_difficulty:
            exactMatch.keyword_difficulty ?? exactMatch.keyword_properties?.keyword_difficulty ?? null,
          intent: classifyIntent(exactMatch.keyword),
          monthly_searches: exactMatch.monthly_searches ?? [],
        };
      } else {
        let volume: Awaited<ReturnType<typeof dfs.keywords.getBulkVolume>> = [];
        try {
          volume = await dfs.keywords.getBulkVolume([keyword], locationCode, languageCode);
        } catch (volErr) {
          console.warn("[keywords/overview] volume fetch failed (non-fatal):", volErr instanceof Error ? volErr.message : volErr);
        }
        const v = volume?.[0];
        main = v?.keyword
          ? {
              keyword: v.keyword,
              search_volume: v.search_volume ?? 0,
              cpc: v.cpc ?? 0,
              keyword_difficulty: null as number | null,
              intent: classifyIntent(v.keyword),
              monthly_searches: v.monthly_searches ?? [],
            }
          : {
              keyword,
              search_volume: 0,
              cpc: 0,
              keyword_difficulty: null as number | null,
              intent: classifyIntent(keyword),
              monthly_searches: [],
            };
      }

      // ── Enrich KD via bulk_keyword_difficulty for any null values ──────────
      const allKws = [main.keyword, ...related.map((r) => r.keyword)];
      const kdCacheMap: Record<string, number | null> = {};

      // Check per-keyword KD cache first
      await Promise.all(
        allKws.map(async (kw) => {
          const hit = await redis.get(`kd:${kw}:${locationCode}`);
          if (hit !== null) kdCacheMap[kw] = JSON.parse(hit) as number | null;
        })
      );

      const needKd = allKws.filter((kw) => kdCacheMap[kw] === undefined);
      if (needKd.length > 0) {
        try {
          const kdItems = await dfs.labs.getBulkKeywordDifficulty(needKd, locationCode, languageCode);
          console.log("KD RESULT:", JSON.stringify(kdItems, null, 2));
          await Promise.all(
            kdItems.map(async (item) => {
              kdCacheMap[item.keyword] = item.keyword_difficulty;
              await redis.setex(`kd:${item.keyword}:${locationCode}`, 86_400, JSON.stringify(item.keyword_difficulty));
            })
          );
        } catch (kdErr) {
          console.warn("[keywords/overview] bulk KD fetch failed (non-fatal):", kdErr instanceof Error ? kdErr.message : kdErr);
        }
      }

      // Apply KD where still null
      if (main.keyword_difficulty === null && kdCacheMap[main.keyword] != null) {
        main = { ...main, keyword_difficulty: kdCacheMap[main.keyword]! };
      }
      const enrichedRelated = related.map((r) =>
        r.keyword_difficulty === null && kdCacheMap[r.keyword] != null
          ? { ...r, keyword_difficulty: kdCacheMap[r.keyword]! }
          : r
      );

      const result = { main, related: enrichedRelated };
      console.log("FULL RESULT:", JSON.stringify(result, null, 2));
      await redis.setex(cacheKey, CACHE_TTL.KEYWORD_DATA, JSON.stringify(result));
      return c.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[keywords/overview] ERROR:", msg, err);
      return c.json({ error: "Failed to fetch keyword data", detail: msg }, 500);
    }
  }
);

// ─── Ideas ────────────────────────────────────────────────────────────────────

router.get("/ideas", async (c) => {
  const keyword = c.req.query("keyword");
  if (!keyword) return c.json({ error: "keyword is required" }, 400);

  const locationCode = Number(c.req.query("location") ?? c.req.query("locationCode") ?? "2356");
  const languageCode = c.req.query("languageCode") ?? "en";

  try {
    const result = await fetchKeywordIdeas(keyword, locationCode, languageCode);
    return c.json(result);
  } catch (err) {
    console.error("[keywords/ideas:get]", err);
    return c.json({ error: "Failed to fetch keyword ideas" }, 500);
  }
});

router.post(
  "/ideas",
  zValidator(
    "json",
    z.object({
      keyword: z.string().min(1).max(200),
      locationCode: z.number().int().positive().default(2356),
      languageCode: z.string().default("en"),
    })
  ),
  async (c) => {
    const { keyword, locationCode, languageCode } = c.req.valid("json");

    try {
      const result = await fetchKeywordIdeas(keyword, locationCode, languageCode);
      return c.json(result);
    } catch (err) {
      console.error("[keywords/ideas]", err);
      return c.json({ error: "Failed to fetch keyword ideas" }, 500);
    }
  }
);

// ─── Tracked Keywords ──────────────────────────────────────────────────────────

router.get("/projects/:projectId/tracked", async (c) => {
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
    .where(eq(trackedKeywords.projectId, projectId))
    .orderBy(trackedKeywords.createdAt);

  return c.json({ keywords: kws });
});

router.post(
  "/projects/:projectId/tracked",
  enforcePlanLimit("keywords"),
  zValidator("json", addKeywordsSchema),
  async (c) => {
    const orgId = c.get("orgId");
    const db = getDb();
    const { projectId } = c.req.param();
    const { keywords, locationCode, languageCode, device } = c.req.valid("json");

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
    });
    if (!project) return c.json({ error: "Project not found" }, 404);

    const rows = keywords.map((keyword) => ({
      id: createId(),
      projectId,
      keyword,
      locationCode: String(locationCode),
      languageCode,
      device,
      isActive: true,
    }));

    const inserted = await db.insert(trackedKeywords).values(rows).returning();
    return c.json({ keywords: inserted }, 201);
  }
);

router.delete("/projects/:projectId/tracked/:keywordId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId, keywordId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  await db
    .delete(trackedKeywords)
    .where(
      and(eq(trackedKeywords.id, keywordId), eq(trackedKeywords.projectId, projectId))
    );

  return c.json({ success: true });
});

// ─── Keyword Research (legacy) ─────────────────────────────────────────────────

router.post("/research", zValidator("json", researchSchema), async (c) => {
  const { keyword, locationCode, languageCode, type } = c.req.valid("json");
  const dfs = getDataForSEO();

  switch (type) {
    case "suggestions": {
      const results = await dfs.keywords.getSuggestions(keyword, locationCode, languageCode);
      return c.json({ type, results });
    }
    case "ideas": {
      const results = await dfs.keywords.getKeywordIdeas(keyword, locationCode, languageCode);
      return c.json({ type, results });
    }
    case "volume": {
      const results = await dfs.keywords.getBulkVolume([keyword], locationCode, languageCode);
      return c.json({ type, results });
    }
  }
});

router.post(
  "/bulk-volume",
  zValidator(
    "json",
    z.object({
      keywords: z.array(z.string()).min(1).max(700),
      locationCode: z.number().int().positive().default(2356),
      languageCode: z.string().default("en"),
    })
  ),
  async (c) => {
    const { keywords, locationCode, languageCode } = c.req.valid("json");
    const dfs = getDataForSEO();
    const results = await dfs.keywords.getBulkVolume(keywords, locationCode, languageCode);
    return c.json({ results });
  }
);

router.post(
  "/bulk",
  zValidator(
    "json",
    z.object({
      keywords: z.array(z.string().min(1).max(200)).min(1).max(200),
      locationCode: z.number().int().nonnegative().default(2356),
      languageCode: z.string().default("en"),
    })
  ),
  async (c) => {
    const { keywords, locationCode, languageCode } = c.req.valid("json");
    const normalizedLocationCode = normalizeLocationCode(locationCode);

    try {
      if (!hasCreds()) {
        const results = keywords.map((keyword, index) =>
          toKeywordRow({
            keyword,
            search_volume: 300 + index * 120,
            cpc: 1.2 + (index % 7),
            keyword_difficulty: 18 + (index * 7) % 80,
            competition: Number((0.15 + ((index * 13) % 70) / 100).toFixed(2)),
            monthly_searches: Array.from({ length: 12 }, (_, monthOffset) => ({
              year: new Date().getFullYear(),
              month: monthOffset + 1,
              search_volume: 200 + ((index + monthOffset) * 97) % 2000,
            })),
          })
        );
        return c.json({ results });
      }

      const dfs = getDataForSEO();
      const [volumeRows, kdRows] = await Promise.allSettled([
        dfs.keywords.getBulkVolume(keywords, normalizedLocationCode, languageCode),
        dfs.labs.getBulkKeywordDifficulty(keywords, normalizedLocationCode, languageCode),
      ]);

      if (volumeRows.status === "rejected") {
        console.warn("[keywords/bulk] volume fetch failed (non-fatal):", volumeRows.reason instanceof Error ? volumeRows.reason.message : volumeRows.reason);
      }
      if (kdRows.status === "rejected") {
        console.warn("[keywords/bulk] KD fetch failed (non-fatal):", kdRows.reason instanceof Error ? kdRows.reason.message : kdRows.reason);
      }

      const volumeData = volumeRows.status === "fulfilled" ? volumeRows.value : [];
      const kdData = kdRows.status === "fulfilled" ? kdRows.value : [];

      const kdMap = new Map(kdData.map((item) => [item.keyword.toLowerCase(), item.keyword_difficulty]));
      const volumeMap = new Map(volumeData.map((item) => [item.keyword.toLowerCase(), item]));

      const results = keywords.map((keyword) => {
        const volume = volumeMap.get(keyword.toLowerCase());
        return toKeywordRow({
          keyword,
          search_volume: volume?.search_volume ?? 0,
          cpc: volume?.cpc ?? 0,
          keyword_difficulty: kdMap.get(keyword.toLowerCase()) ?? null,
          monthly_searches: volume?.monthly_searches ?? [],
          competition: volume?.competition ?? null,
        });
      });

      return c.json({ results });
    } catch (err) {
      console.error("[keywords/bulk]", err);
      return c.json({ error: "Failed to analyze keywords" }, 500);
    }
  }
);

router.post(
  "/strategy",
  zValidator(
    "json",
    z.object({
      topic: z.string().min(3).max(200),
      url: z.string().url().optional(),
      locationCode: z.number().int().nonnegative().default(2356),
      languageCode: z.string().default("en"),
    })
  ),
  async (c) => {
    const { topic, url, locationCode, languageCode } = c.req.valid("json");
    const seed = url ? `${topic} ${new URL(url).hostname.replace(/^www\./, "")}` : topic;

    try {
      const ideas = await fetchKeywordIdeas(seed, locationCode, languageCode);
      const sorted = [...ideas.ideas].sort((a, b) => b.search_volume - a.search_volume);
      const pillarKeywords = sorted.slice(0, 5);
      const supportingKeywords = clusterSupportingKeywords(sorted.slice(5, 25));
      const quickWins = sorted
        .filter((item) => (item.keyword_difficulty ?? 101) < 30 && item.search_volume > 500)
        .slice(0, 12);

      return c.json({
        pillarKeywords,
        supportingKeywords,
        quickWins,
      });
    } catch (err) {
      console.error("[keywords/strategy]", err);
      return c.json({ error: "Failed to build keyword strategy" }, 500);
    }
  }
);

// ─── Keyword Lists ─────────────────────────────────────────────────────────────

router.get("/lists", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const projectId = c.req.query("projectId");

  const orgProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.orgId, orgId));

  const allowedProjects = projectId
    ? orgProjects.filter((project) => project.id === projectId)
    : orgProjects;

  if (projectId && allowedProjects.length === 0) {
    return c.json({ error: "Project not found" }, 404);
  }
  if (allowedProjects.length === 0) return c.json({ lists: [] });

  const projectIds = allowedProjects.map((project) => project.id);
  const projectMap = new Map(
    allowedProjects.map((project) => [project.id, { name: project.name, domain: project.domain }])
  );

  const lists = await db.query.keywordLists.findMany({
    where: inArray(keywordLists.projectId, projectIds),
    with: { items: { with: { keyword: true } } },
  });

  return c.json({
    lists: lists.map((list) => ({
      ...list,
      projectName: projectMap.get(list.projectId)?.name ?? "Unknown Project",
      projectDomain: projectMap.get(list.projectId)?.domain ?? "",
    })),
  });
});

router.post(
  "/lists",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(100),
      projectId: z.string().optional(),
    })
  ),
  async (c) => {
    const orgId = c.get("orgId");
    const db = getDb();
    const { name, projectId } = c.req.valid("json");

    const orgProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.orgId, orgId));

    const project =
      (projectId ? orgProjects.find((item) => item.id === projectId) : undefined) ??
      orgProjects[0];

    if (!project) return c.json({ error: "Project not found" }, 404);

    const [list] = await db
      .insert(keywordLists)
      .values({ id: createId(), projectId: project.id, name })
      .returning();

    return c.json({ list }, 201);
  }
);

router.delete("/lists/:listId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { listId } = c.req.param();

  const list = await db.query.keywordLists.findFirst({
    where: eq(keywordLists.id, listId),
    with: { project: true },
  });
  if (!list || list.project.orgId !== orgId) {
    return c.json({ error: "List not found" }, 404);
  }

  await db.delete(keywordLists).where(eq(keywordLists.id, listId));
  return c.json({ success: true });
});

router.post(
  "/lists/:listId/keywords",
  enforcePlanLimit("keywords"),
  zValidator(
    "json",
    z.object({
      keywords: z.array(z.string().min(1).max(200)).min(1).max(200),
      locationCode: z.number().int().positive().default(2356),
      languageCode: z.string().default("en"),
    })
  ),
  async (c) => {
    const orgId = c.get("orgId");
    const db = getDb();
    const { listId } = c.req.param();
    const { keywords, locationCode, languageCode } = c.req.valid("json");

    const list = await db.query.keywordLists.findFirst({
      where: eq(keywordLists.id, listId),
      with: { project: true },
    });
    if (!list || list.project.orgId !== orgId) {
      return c.json({ error: "List not found" }, 404);
    }

    const projectId = list.projectId;
    const existing = await db
      .select()
      .from(trackedKeywords)
      .where(and(eq(trackedKeywords.projectId, projectId), inArray(trackedKeywords.keyword, keywords)));
    const existingMap = new Map(existing.map((item) => [item.keyword, item]));

    const newKeywords = keywords.filter((keyword) => !existingMap.has(keyword));
    if (newKeywords.length > 0) {
      const inserted = await db
        .insert(trackedKeywords)
        .values(
          newKeywords.map((keyword) => ({
            id: createId(),
            projectId,
            keyword,
            locationCode: String(locationCode),
            languageCode,
            device: "desktop" as const,
            isActive: true,
          }))
        )
        .returning();
      inserted.forEach((item) => existingMap.set(item.keyword, item));
    }

    const allKeywordIds = keywords.map((keyword) => existingMap.get(keyword)!.id);
    const existingItems = await db
      .select()
      .from(keywordListItems)
      .where(and(eq(keywordListItems.listId, listId), inArray(keywordListItems.keywordId, allKeywordIds)));
    const existingItemIds = new Set(existingItems.map((item) => item.keywordId));

    const rows = allKeywordIds
      .filter((keywordId) => !existingItemIds.has(keywordId))
      .map((keywordId) => ({ id: createId(), listId, keywordId }));

    if (rows.length > 0) {
      await db.insert(keywordListItems).values(rows);
    }

    return c.json({ added: rows.length }, 201);
  }
);

router.get("/projects/:projectId/lists", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const lists = await db.query.keywordLists.findMany({
    where: eq(keywordLists.projectId, projectId),
    with: { items: { with: { keyword: true } } },
    orderBy: keywordLists.createdAt,
  });

  return c.json({ lists });
});

router.post(
  "/projects/:projectId/lists",
  zValidator("json", z.object({ name: z.string().min(1).max(100) })),
  async (c) => {
    const orgId = c.get("orgId");
    const db = getDb();
    const { projectId } = c.req.param();
    const { name } = c.req.valid("json");

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
    });
    if (!project) return c.json({ error: "Project not found" }, 404);

    const [list] = await db
      .insert(keywordLists)
      .values({ id: createId(), projectId, name })
      .returning();

    return c.json({ list }, 201);
  }
);

router.delete("/projects/:projectId/lists/:listId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId, listId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  await db
    .delete(keywordLists)
    .where(and(eq(keywordLists.id, listId), eq(keywordLists.projectId, projectId)));

  return c.json({ success: true });
});

router.post(
  "/projects/:projectId/lists/:listId/keywords",
  enforcePlanLimit("keywords"),
  zValidator(
    "json",
    z.object({
      keywords: z.array(z.string().min(1).max(200)).min(1).max(100),
      locationCode: z.number().int().positive().default(2356),
      languageCode: z.string().default("en"),
    })
  ),
  async (c) => {
    const orgId = c.get("orgId");
    const db = getDb();
    const { projectId, listId } = c.req.param();
    const { keywords, locationCode, languageCode } = c.req.valid("json");

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
    });
    if (!project) return c.json({ error: "Project not found" }, 404);

    const list = await db.query.keywordLists.findFirst({
      where: and(eq(keywordLists.id, listId), eq(keywordLists.projectId, projectId)),
    });
    if (!list) return c.json({ error: "List not found" }, 404);

    // Upsert tracked keywords
    const existing = await db
      .select()
      .from(trackedKeywords)
      .where(and(eq(trackedKeywords.projectId, projectId), inArray(trackedKeywords.keyword, keywords)));
    const existingMap = new Map(existing.map((k) => [k.keyword, k]));

    const newKws = keywords.filter((kw) => !existingMap.has(kw));
    if (newKws.length > 0) {
      const rows = newKws.map((keyword) => ({
        id: createId(),
        projectId,
        keyword,
        locationCode: String(locationCode),
        languageCode,
        device: "desktop" as const,
        isActive: true,
      }));
      const inserted = await db.insert(trackedKeywords).values(rows).returning();
      inserted.forEach((k) => existingMap.set(k.keyword, k));
    }

    // Add to list, skipping duplicates
    const allKwIds = keywords.map((kw) => existingMap.get(kw)!.id);
    const existingItems = await db
      .select()
      .from(keywordListItems)
      .where(and(eq(keywordListItems.listId, listId), inArray(keywordListItems.keywordId, allKwIds)));
    const existingItemKwIds = new Set(existingItems.map((i) => i.keywordId));

    const newItems = allKwIds
      .filter((kwId) => !existingItemKwIds.has(kwId))
      .map((keywordId) => ({ id: createId(), listId, keywordId }));

    if (newItems.length > 0) {
      await db.insert(keywordListItems).values(newItems);
    }

    return c.json({ added: newItems.length }, 201);
  }
);

router.delete("/projects/:projectId/lists/:listId/keywords/:itemId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId, listId, itemId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  await db
    .delete(keywordListItems)
    .where(and(eq(keywordListItems.id, itemId), eq(keywordListItems.listId, listId)));

  return c.json({ success: true });
});

router.get("/projects/:projectId/lists/:listId/export", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId, listId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const list = await db.query.keywordLists.findFirst({
    where: and(eq(keywordLists.id, listId), eq(keywordLists.projectId, projectId)),
    with: { items: { with: { keyword: true } } },
  });
  if (!list) return c.json({ error: "List not found" }, 404);

  const header = ["keyword", "location_code", "language_code", "device", "added_date"];
  const rows = list.items.map((item) => [
    `"${item.keyword.keyword.replace(/"/g, '""')}"`,
    item.keyword.locationCode,
    item.keyword.languageCode,
    item.keyword.device,
    item.keyword.createdAt.toISOString().split("T")[0],
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");

  c.header("Content-Type", "text/csv");
  c.header("Content-Disposition", `attachment; filename="${list.name.replace(/[^a-z0-9]/gi, "_")}.csv"`);
  return c.text(csv);
});

export default router;
