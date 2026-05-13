import "../types.js";
import { createHash } from "crypto";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../lib/db/index.js";
import { trackedKeywords, projects, keywordLists, keywordListItems } from "@garage-seo/db";
import { eq, and, inArray } from "drizzle-orm";
import { createId } from "@garage-seo/db";
import { DataForSEO } from "@garage-seo/dataforseo";
import { ClaudeClient, type KeywordStrategyOutput } from "@garage-seo/ai";
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
  competition_level?: string | null;
  serp_item_types?: string[] | null;
}) {
  return {
    keyword: item.keyword,
    search_volume: item.search_volume ?? 0,
    cpc: item.cpc ?? 0,
    keyword_difficulty: item.keyword_difficulty ?? null,
    intent: classifyIntent(item.keyword),
    monthly_searches: item.monthly_searches ?? [],
    competition: item.competition ?? null,
    competition_level: item.competition_level ?? null,
    serp_item_types: item.serp_item_types ?? [],
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
    competition: 0.42,
    competition_level: "MEDIUM",
    serp_item_types: ["organic", "people_also_ask", "featured_snippet", "sitelinks"],
  };
  const seeds = [
    "tools", "software", "checker", "analyzer", "guide", "tips",
    "best", "free", "online", "tutorial", "examples", "strategy",
    "course", "platform", "agency", "services", "cost", "audit",
    "report", "ranking",
  ];
  const related = seeds.map((suffix, i) => {
    const kw = `${keyword} ${suffix}`;
    const comp = Math.random();
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
      competition: comp,
      competition_level: comp < 0.34 ? "LOW" : comp < 0.67 ? "MEDIUM" : "HIGH",
      serp_item_types: [] as string[],
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
      device: z.enum(["desktop", "mobile"]).optional(),
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
          competition: s.competition ?? null,
          competition_level: s.competition_level ?? null,
          serp_item_types: s.serp_item_types ?? [],
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
          competition: exactMatch.competition ?? null,
          competition_level: exactMatch.competition_level ?? null,
          serp_item_types: exactMatch.serp_item_types ?? [],
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
              competition: v.competition ?? null,
              competition_level: v.competition_level ?? null,
              serp_item_types: [] as string[],
            }
          : {
              keyword,
              search_volume: 0,
              cpc: 0,
              keyword_difficulty: null as number | null,
              intent: classifyIntent(keyword),
              monthly_searches: [],
              competition: null as number | null,
              competition_level: null as string | null,
              serp_item_types: [] as string[],
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

// ─── SERP (organic + PAA + features) ──────────────────────────────────────────

type SerpResponse = {
  organic: Array<{
    position: number;
    domain: string;
    url: string;
    title: string;
    description: string;
  }>;
  paa: Array<{
    question: string;
    featured_title?: string;
    featured_url?: string;
  }>;
  serp_features: string[];
};

function makeSerpCacheKey(keyword: string, locationCode: number, device: string): string {
  const hash = createHash("sha256")
    .update(`${keyword.toLowerCase()}|${locationCode}|${device}`)
    .digest("hex");
  return `serp:${hash}`;
}

function makeMockSerp(keyword: string): SerpResponse {
  const slug = keyword.replace(/\s+/g, "-").toLowerCase();
  return {
    organic: [
      {
        position: 1,
        domain: "wikipedia.org",
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(keyword)}`,
        title: `${keyword} - Wikipedia`,
        description: `Comprehensive Wikipedia article about ${keyword}, including key concepts, history, and further reading.`,
      },
      {
        position: 2,
        domain: "moz.com",
        url: `https://moz.com/learn/seo/${slug}`,
        title: `What is ${keyword}? - Moz`,
        description: `In-depth explanation of ${keyword}, why it matters for SEO, and best practices for implementation.`,
      },
      {
        position: 3,
        domain: "ahrefs.com",
        url: `https://ahrefs.com/blog/${slug}`,
        title: `${keyword}: A Complete Guide - Ahrefs`,
        description: `Step-by-step guide to mastering ${keyword} with real-world examples and case studies.`,
      },
      {
        position: 4,
        domain: "semrush.com",
        url: `https://www.semrush.com/blog/${slug}/`,
        title: `${keyword} Strategy for 2026 - Semrush`,
        description: `Learn how top brands are leveraging ${keyword} to drive sustainable growth this year.`,
      },
      {
        position: 5,
        domain: "backlinko.com",
        url: `https://backlinko.com/${slug}`,
        title: `${keyword} Guide (Updated 2026)`,
        description: `Everything you need to know about ${keyword} — written by SEO experts and updated for 2026.`,
      },
    ],
    paa: [
      {
        question: `What is ${keyword}?`,
        featured_title: `${keyword} - Definition`,
        featured_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(keyword)}`,
      },
      {
        question: `How does ${keyword} work?`,
        featured_title: `${keyword} explained`,
        featured_url: `https://moz.com/learn/seo/${slug}`,
      },
      {
        question: `Why is ${keyword} important for SEO?`,
        featured_title: `The importance of ${keyword}`,
        featured_url: `https://ahrefs.com/blog/${slug}`,
      },
      {
        question: `What are the best tools for ${keyword}?`,
        featured_title: `Top ${keyword} tools 2026`,
        featured_url: `https://www.semrush.com/blog/${slug}/`,
      },
      {
        question: `${keyword} vs alternatives — which is better?`,
        featured_title: `Comparison guide`,
        featured_url: `https://backlinko.com/${slug}`,
      },
    ],
    serp_features: ["organic", "people_also_ask", "featured_snippet", "sitelinks", "ai_overview"],
  };
}

router.post(
  "/serp",
  zValidator(
    "json",
    z.object({
      keyword: z.string().min(1).max(200),
      locationCode: z.number().int().positive().default(2356),
      device: z.enum(["desktop", "mobile"]).default("desktop"),
    })
  ),
  async (c) => {
    const { keyword, locationCode, device } = c.req.valid("json");
    const cacheKey = makeSerpCacheKey(keyword, locationCode, device);
    const redis = getRedis();

    // Cache hit — return instantly
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return c.json(JSON.parse(cached) as SerpResponse);
      }
    } catch (err) {
      console.warn("[keywords/serp] cache read failed:", err instanceof Error ? err.message : err);
    }

    // Mock fallback when DataForSEO creds are absent
    if (!hasCreds()) {
      const mock = makeMockSerp(keyword);
      await redis.setex(cacheKey, 21_600, JSON.stringify(mock)).catch(() => {});
      return c.json(mock);
    }

    try {
      const dfs = getDataForSEO();
      const raw = await dfs.serp.getOrganicResults(keyword, locationCode, "en", device, 100, 90_000);

      // DataForSEO returns mixed item types in `items[]`; the TS type narrows to organic
      // but the actual payload includes people_also_ask, featured_snippet, etc.
      const items = raw.items as unknown as Array<{
        type: string;
        rank_absolute?: number;
        domain?: string;
        url?: string;
        title?: string;
        description?: string;
        items?: Array<{
          type?: string;
          title?: string;
          expanded_element?: Array<{
            featured_title?: string;
            url?: string;
            description?: string;
          }>;
        }>;
      }>;

      const organic = items
        .filter(
          (it) =>
            it.type === "organic" && it.rank_absolute && it.domain && it.url && it.title
        )
        .slice(0, 10)
        .map((it) => ({
          position: it.rank_absolute!,
          domain: it.domain!,
          url: it.url!,
          title: it.title!,
          description: it.description ?? "",
        }));

      const paaContainer = items.find((it) => it.type === "people_also_ask");
      const paa = (paaContainer?.items ?? [])
        .filter((q) => q.title)
        .slice(0, 10)
        .map((q) => ({
          question: q.title!,
          featured_title: q.expanded_element?.[0]?.featured_title,
          featured_url: q.expanded_element?.[0]?.url,
        }));

      const response: SerpResponse = {
        organic,
        paa,
        serp_features: raw.item_types ?? [],
      };

      await redis.setex(cacheKey, 21_600, JSON.stringify(response)).catch(() => {});
      return c.json(response);
    } catch (err) {
      console.error("[keywords/serp]", err);
      const msg = err instanceof Error ? err.message : "Failed to fetch SERP data";
      return c.json({ error: msg }, 500);
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

    // Dedup against existing (projectId, keyword, locationCode, languageCode, device)
    const locationStr = String(locationCode);
    const existing = await db
      .select({
        keyword: trackedKeywords.keyword,
        locationCode: trackedKeywords.locationCode,
        languageCode: trackedKeywords.languageCode,
        device: trackedKeywords.device,
      })
      .from(trackedKeywords)
      .where(
        and(
          eq(trackedKeywords.projectId, projectId),
          inArray(trackedKeywords.keyword, keywords),
          eq(trackedKeywords.locationCode, locationStr),
          eq(trackedKeywords.languageCode, languageCode),
          eq(trackedKeywords.device, device)
        )
      );
    const existingSet = new Set(existing.map((e) => e.keyword));
    const newKeywords = keywords.filter((kw) => !existingSet.has(kw));

    let inserted: Array<typeof trackedKeywords.$inferSelect> = [];
    if (newKeywords.length > 0) {
      inserted = await db
        .insert(trackedKeywords)
        .values(
          newKeywords.map((keyword) => ({
            id: createId(),
            projectId,
            keyword,
            locationCode: locationStr,
            languageCode,
            device,
            isActive: true,
          }))
        )
        .returning();
    }

    return c.json(
      {
        keywords: inserted,
        added: inserted.length,
        duplicates: keywords.length - newKeywords.length,
      },
      201
    );
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
          competition_level: volume?.competition_level ?? null,
        });
      });

      return c.json({ results });
    } catch (err) {
      console.error("[keywords/bulk]", err);
      return c.json({ error: "Failed to analyze keywords" }, 500);
    }
  }
);

function makeMockStrategy(topic: string): KeywordStrategyOutput {
  const t = topic.trim();
  const slug = t.replace(/\s+/g, " ").toLowerCase();
  return {
    pillar: {
      keyword: `best ${slug}`,
      volume: 12_100,
      kd: 42,
      cpc: 4.5,
      rationale: `"${t}" is a transactional head term with strong commercial intent and moderate competition — the right anchor for the primary landing page.`,
    },
    clusters: [
      {
        topic: "Decision-stage comparisons",
        pillar_page: {
          keyword: `${slug} vs alternatives`,
          volume: 2_400,
          kd: 38,
          content_type: "Comparison",
        },
        supporting_keywords: [
          { keyword: `top ${slug} alternatives`, volume: 1_800, kd: 32, is_quick_win: true },
          { keyword: `${slug} vs free options`, volume: 720, kd: 24, is_quick_win: true },
          { keyword: `cheapest ${slug}`, volume: 480, kd: 21, is_quick_win: true },
          { keyword: `${slug} pricing comparison`, volume: 990, kd: 41, is_quick_win: false },
        ],
      },
      {
        topic: "Educational / top of funnel",
        pillar_page: {
          keyword: `what is ${slug}`,
          volume: 5_400,
          kd: 28,
          content_type: "Blog Post",
        },
        supporting_keywords: [
          { keyword: `${slug} guide`, volume: 3_300, kd: 30, is_quick_win: true },
          { keyword: `how does ${slug} work`, volume: 1_900, kd: 24, is_quick_win: true },
          { keyword: `${slug} benefits`, volume: 880, kd: 22, is_quick_win: true },
          { keyword: `${slug} examples`, volume: 1_100, kd: 26, is_quick_win: true },
        ],
      },
      {
        topic: "Implementation & best practice",
        pillar_page: {
          keyword: `${slug} best practices`,
          volume: 1_600,
          kd: 36,
          content_type: "Guide",
        },
        supporting_keywords: [
          { keyword: `${slug} checklist`, volume: 720, kd: 22, is_quick_win: true },
          { keyword: `${slug} mistakes to avoid`, volume: 540, kd: 19, is_quick_win: true },
          { keyword: `${slug} step by step`, volume: 410, kd: 28, is_quick_win: true },
        ],
      },
      {
        topic: "FAQ & objections",
        pillar_page: {
          keyword: `${slug} faq`,
          volume: 320,
          kd: 18,
          content_type: "FAQ",
        },
        supporting_keywords: [
          { keyword: `is ${slug} worth it`, volume: 880, kd: 25, is_quick_win: true },
          { keyword: `${slug} pros and cons`, volume: 660, kd: 26, is_quick_win: true },
          { keyword: `do i need ${slug}`, volume: 410, kd: 20, is_quick_win: true },
        ],
      },
    ],
    content_calendar: [
      { week: 1, content_type: "Blog Post", keyword: `${slug} guide`, estimated_volume: 3_300, priority: "high" },
      { week: 1, content_type: "FAQ", keyword: `is ${slug} worth it`, estimated_volume: 880, priority: "high" },
      { week: 2, content_type: "Blog Post", keyword: `how does ${slug} work`, estimated_volume: 1_900, priority: "high" },
      { week: 2, content_type: "Comparison", keyword: `top ${slug} alternatives`, estimated_volume: 1_800, priority: "high" },
      { week: 3, content_type: "Blog Post", keyword: `${slug} examples`, estimated_volume: 1_100, priority: "medium" },
      { week: 3, content_type: "Guide", keyword: `${slug} checklist`, estimated_volume: 720, priority: "medium" },
      { week: 4, content_type: "Comparison", keyword: `${slug} vs free options`, estimated_volume: 720, priority: "medium" },
      { week: 4, content_type: "FAQ", keyword: `${slug} pros and cons`, estimated_volume: 660, priority: "medium" },
      { week: 5, content_type: "Landing Page", keyword: `best ${slug}`, estimated_volume: 12_100, priority: "high" },
      { week: 6, content_type: "Guide", keyword: `${slug} best practices`, estimated_volume: 1_600, priority: "medium" },
      { week: 7, content_type: "Blog Post", keyword: `${slug} mistakes to avoid`, estimated_volume: 540, priority: "low" },
      { week: 8, content_type: "FAQ", keyword: `do i need ${slug}`, estimated_volume: 410, priority: "low" },
    ],
    summary: `A 4-cluster strategy anchored on "best ${slug}" as the primary landing page, supported by educational, comparison, implementation, and FAQ clusters. Quick wins in the FAQ and education clusters can build authority fast while the comparison and landing pages chase commercial intent.`,
  };
}

router.post(
  "/strategy",
  zValidator(
    "json",
    z.object({
      topic: z.string().min(3).max(200),
      targetUrl: z.string().url().optional(),
      url: z.string().url().optional(),
      locationCode: z.number().int().nonnegative().default(2356),
      languageCode: z.string().default("en"),
      device: z.enum(["desktop", "mobile"]).optional(),
    })
  ),
  async (c) => {
    const body = c.req.valid("json");
    const targetUrl = body.targetUrl ?? body.url;
    const { topic, locationCode, languageCode } = body;
    const seed = targetUrl ? `${topic} ${new URL(targetUrl).hostname.replace(/^www\./, "")}` : topic;

    const hasClaude = !!process.env["ANTHROPIC_API_KEY"];

    // Mock fallback when either DataForSEO or Claude credentials are missing
    if (!hasCreds() || !hasClaude) {
      console.log(
        `[keywords/strategy] mock fallback (DFS=${hasCreds()}, Claude=${hasClaude})`
      );
      return c.json(makeMockStrategy(topic));
    }

    try {
      const ideas = await fetchKeywordIdeas(seed, locationCode, languageCode);
      const topKeywords = [...ideas.ideas]
        .sort((a, b) => b.search_volume - a.search_volume)
        .slice(0, 25)
        .map((kw) => ({
          keyword: kw.keyword,
          volume: kw.search_volume,
          kd: kw.keyword_difficulty,
          cpc: kw.cpc,
          intent: kw.intent,
        }));

      if (topKeywords.length === 0) {
        return c.json({ error: "No keyword data available for this topic" }, 404);
      }

      const claude = new ClaudeClient();
      const strategy = await claude.generateKeywordStrategy({
        topic,
        targetUrl,
        locationCode,
        keywordData: topKeywords,
      });

      return c.json(strategy);
    } catch (err) {
      console.error("[keywords/strategy]", err);
      const msg = err instanceof Error ? err.message : "Failed to build keyword strategy";
      return c.json({ error: msg }, 500);
    }
  }
);

// ─── Keyword Lists ─────────────────────────────────────────────────────────────

router.get("/lists", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const projectId = c.req.query("projectId");

  console.log(`[keywords/lists:get] orgId="${orgId}" projectIdFilter="${projectId ?? "none"}"`);

  const orgProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.orgId, orgId));

  console.log(`[keywords/lists:get] found ${orgProjects.length} org projects:`, orgProjects.map((p) => ({ id: p.id, name: p.name, orgId: p.orgId })));

  const allowedProjects = projectId
    ? orgProjects.filter((project) => project.id === projectId)
    : orgProjects;

  if (projectId && allowedProjects.length === 0) {
    return c.json({ error: "Project not found" }, 404);
  }
  if (allowedProjects.length === 0) {
    console.log(`[keywords/lists:get] no projects for orgId="${orgId}" — returning empty lists`);
    return c.json({ lists: [] });
  }

  const projectIds = allowedProjects.map((project) => project.id);
  const projectMap = new Map(
    allowedProjects.map((project) => [project.id, { name: project.name, domain: project.domain }])
  );

  const lists = await db.query.keywordLists.findMany({
    where: inArray(keywordLists.projectId, projectIds),
    with: { items: { with: { keyword: true } } },
  });

  console.log(`[keywords/lists:get] found ${lists.length} lists for projectIds=[${projectIds.join(", ")}]`);

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

    console.log(`[keywords/lists:post] orgId="${orgId}" projectId="${projectId ?? "none"}" name="${name}"`);

    const orgProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.orgId, orgId));

    console.log(`[keywords/lists:post] found ${orgProjects.length} org projects for orgId="${orgId}":`, orgProjects.map((p) => ({ id: p.id, name: p.name })));

    const project =
      (projectId ? orgProjects.find((item) => item.id === projectId) : undefined) ??
      orgProjects[0];

    if (!project) {
      console.log(`[keywords/lists:post] no matching project — returning 404`);
      return c.json({ error: "Project not found" }, 404);
    }

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

// ─── Enrich list (volume + KD + CPC + intent) ─────────────────────────────────

router.post("/projects/:projectId/lists/:listId/enrich", async (c) => {
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
  if (list.items.length === 0) {
    return c.json({ enriched: 0, failed: 0 });
  }

  const locationCode = Number(list.items[0]!.keyword.locationCode || "2356");
  const languageCode = list.items[0]!.keyword.languageCode || "en";
  const uniqueKeywords = Array.from(new Set(list.items.map((i) => i.keyword.keyword)));

  // Build volume + KD map (real or mocked)
  type Enriched = { volume: number | null; cpc: number | null; kd: number | null };
  const map = new Map<string, Enriched>();

  try {
    if (!hasCreds()) {
      uniqueKeywords.forEach((kw, idx) => {
        map.set(kw, {
          volume: 300 + idx * 120,
          cpc: Number((1.2 + (idx % 7)).toFixed(2)),
          kd: 18 + ((idx * 7) % 80),
        });
      });
    } else {
      const dfs = getDataForSEO();
      const [volRows, kdRows] = await Promise.allSettled([
        dfs.keywords.getBulkVolume(uniqueKeywords, locationCode, languageCode),
        dfs.labs.getBulkKeywordDifficulty(uniqueKeywords, locationCode, languageCode),
      ]);
      const vols = volRows.status === "fulfilled" ? volRows.value : [];
      const kds = kdRows.status === "fulfilled" ? kdRows.value : [];
      const volMap = new Map(vols.map((v) => [v.keyword.toLowerCase(), v]));
      const kdMap = new Map(kds.map((k) => [k.keyword.toLowerCase(), k.keyword_difficulty]));
      for (const kw of uniqueKeywords) {
        const v = volMap.get(kw.toLowerCase());
        map.set(kw, {
          volume: v?.search_volume ?? null,
          cpc: v?.cpc ?? null,
          kd: kdMap.get(kw.toLowerCase()) ?? null,
        });
      }
    }
  } catch (err) {
    console.error("[keywords/lists/enrich] fetch failed:", err);
    return c.json({ error: "Failed to fetch enrichment data" }, 500);
  }

  // Persist per-item: update each keyword_list_items row in the list with its data
  let enriched = 0;
  let failed = 0;
  await db.transaction(async (tx) => {
    for (const item of list.items) {
      const data = map.get(item.keyword.keyword);
      if (!data) {
        failed++;
        continue;
      }
      await tx
        .update(keywordListItems)
        .set({
          volume: data.volume ?? null,
          kd: data.kd ?? null,
          cpc: data.cpc ?? null,
          intent: classifyIntent(item.keyword.keyword),
        })
        .where(eq(keywordListItems.id, item.id));
      enriched++;
    }
    await tx
      .update(keywordLists)
      .set({ lastEnrichedAt: new Date() })
      .where(eq(keywordLists.id, listId));
  });

  return c.json({ enriched, failed });
});

// ─── Move keywords between lists (same project) ───────────────────────────────

router.post(
  "/projects/:projectId/lists/:listId/move",
  zValidator(
    "json",
    z.object({
      keywordIds: z.array(z.string().min(1)).min(1).max(500),
      targetListId: z.string().min(1),
    })
  ),
  async (c) => {
    const orgId = c.get("orgId");
    const db = getDb();
    const { projectId, listId } = c.req.param();
    const { keywordIds, targetListId } = c.req.valid("json");

    if (listId === targetListId) {
      return c.json({ error: "Source and target lists are the same" }, 400);
    }

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
    });
    if (!project) return c.json({ error: "Project not found" }, 404);

    const [sourceList, targetList] = await Promise.all([
      db.query.keywordLists.findFirst({
        where: and(eq(keywordLists.id, listId), eq(keywordLists.projectId, projectId)),
      }),
      db.query.keywordLists.findFirst({
        where: and(eq(keywordLists.id, targetListId), eq(keywordLists.projectId, projectId)),
      }),
    ]);
    if (!sourceList || !targetList) {
      return c.json({ error: "List not found in this project" }, 404);
    }

    let moved = 0;
    await db.transaction(async (tx) => {
      // Fetch the source items that match the requested keywordIds
      const sourceItems = await tx
        .select()
        .from(keywordListItems)
        .where(
          and(
            eq(keywordListItems.listId, listId),
            inArray(keywordListItems.keywordId, keywordIds)
          )
        );

      if (sourceItems.length === 0) return;

      // Find which keyword_ids are already present in the target list
      const targetExisting = await tx
        .select({ keywordId: keywordListItems.keywordId })
        .from(keywordListItems)
        .where(
          and(
            eq(keywordListItems.listId, targetListId),
            inArray(
              keywordListItems.keywordId,
              sourceItems.map((i) => i.keywordId)
            )
          )
        );
      const targetSet = new Set(targetExisting.map((t) => t.keywordId));

      for (const item of sourceItems) {
        if (targetSet.has(item.keywordId)) {
          // Already in target — just delete the source row
          await tx.delete(keywordListItems).where(eq(keywordListItems.id, item.id));
        } else {
          // Move by updating list_id
          await tx
            .update(keywordListItems)
            .set({ listId: targetListId })
            .where(eq(keywordListItems.id, item.id));
        }
        moved++;
      }
    });

    return c.json({ moved });
  }
);

export default router;
