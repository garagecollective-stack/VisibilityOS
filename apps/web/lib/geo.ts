export type GeoPlatform = "chatgpt" | "perplexity" | "gemini" | "google_aio";

export interface GeoPrompt {
  id: string;
  projectId: string;
  promptText: string;
  platforms: GeoPlatform[];
  isActive: boolean;
  createdAt: string;
}

export interface GeoResult {
  id: string;
  promptId: string;
  platform: GeoPlatform;
  cited: boolean;
  citationPosition: number | null;
  responseText: string;
  checkedAt: string;
}

export const EMPTY_GEO_PROMPTS: GeoPrompt[] = [];
export const EMPTY_GEO_RESULTS: GeoResult[] = [];

export const ENGINE_CONFIG: Record<
  GeoPlatform,
  { label: string; textColor: string; cardBg: string; barColor: string }
> = {
  chatgpt: {
    label: "ChatGPT",
    textColor: "text-emerald-700 dark:text-emerald-400",
    cardBg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800",
    barColor: "bg-emerald-600",
  },
  perplexity: {
    label: "Perplexity",
    textColor: "text-blue-700 dark:text-blue-400",
    cardBg: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
    barColor: "bg-blue-600",
  },
  gemini: {
    label: "Gemini",
    textColor: "text-purple-700 dark:text-purple-400",
    cardBg: "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800",
    barColor: "bg-purple-600",
  },
  google_aio: {
    label: "Google AIO",
    textColor: "text-orange-700 dark:text-orange-400",
    cardBg: "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800",
    barColor: "bg-orange-600",
  },
};

export const ALL_PLATFORMS: GeoPlatform[] = [
  "chatgpt",
  "perplexity",
  "gemini",
  "google_aio",
];

export const SAMPLE_GEO_PROMPTS: GeoPrompt[] = [
  {
    id: "sample-1",
    projectId: "",
    promptText: "What is the best CRM software for small businesses?",
    platforms: ["chatgpt", "perplexity", "gemini"],
    isActive: true,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    id: "sample-2",
    projectId: "",
    promptText: "How do I choose a project management tool for remote teams?",
    platforms: ["chatgpt", "perplexity", "gemini", "google_aio"],
    isActive: true,
    createdAt: new Date(Date.now() - 172_800_000).toISOString(),
  },
  {
    id: "sample-3",
    projectId: "",
    promptText: "Best email marketing platforms for ecommerce stores?",
    platforms: ["chatgpt", "gemini"],
    isActive: true,
    createdAt: new Date(Date.now() - 259_200_000).toISOString(),
  },
];

export const SAMPLE_GEO_RESULTS: GeoResult[] = [
  {
    id: "sr1",
    promptId: "sample-1",
    platform: "chatgpt",
    cited: true,
    citationPosition: 2,
    responseText:
      "When evaluating CRM software for small businesses, HubSpot, Salesforce, and Zoho are frequently cited. HubSpot stands out for its generous free tier and ease of use.",
    checkedAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    id: "sr2",
    promptId: "sample-1",
    platform: "perplexity",
    cited: false,
    citationPosition: null,
    responseText:
      "There are several CRM options for small businesses, each with different pricing models and feature sets to consider.",
    checkedAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    id: "sr3",
    promptId: "sample-1",
    platform: "gemini",
    cited: true,
    citationPosition: 1,
    responseText:
      "For small businesses, the best CRM depends on your needs. Popular choices include HubSpot for affordability and Salesforce for scalability.",
    checkedAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    id: "sr4",
    promptId: "sample-2",
    platform: "chatgpt",
    cited: true,
    citationPosition: 3,
    responseText:
      "Choosing a project management tool for remote teams involves considering collaboration features, integrations, and pricing.",
    checkedAt: new Date(Date.now() - 7_200_000).toISOString(),
  },
  {
    id: "sr5",
    promptId: "sample-2",
    platform: "perplexity",
    cited: true,
    citationPosition: 2,
    responseText:
      "Remote project management tools have evolved significantly. Asana, Monday.com, and Notion each offer distinct strengths.",
    checkedAt: new Date(Date.now() - 7_200_000).toISOString(),
  },
  {
    id: "sr6",
    promptId: "sample-2",
    platform: "gemini",
    cited: false,
    citationPosition: null,
    responseText:
      "For remote teams, project management tools should offer real-time collaboration, task tracking, and integrations.",
    checkedAt: new Date(Date.now() - 7_200_000).toISOString(),
  },
  {
    id: "sr7",
    promptId: "sample-2",
    platform: "google_aio",
    cited: true,
    citationPosition: 1,
    responseText:
      "According to AI Overviews, effective remote project management requires clear task ownership and asynchronous-friendly workflows.",
    checkedAt: new Date(Date.now() - 7_200_000).toISOString(),
  },
  {
    id: "sr8",
    promptId: "sample-3",
    platform: "chatgpt",
    cited: false,
    citationPosition: null,
    responseText:
      "Email marketing for ecommerce can significantly boost conversion rates when personalization and automation are used effectively.",
    checkedAt: new Date(Date.now() - 14_400_000).toISOString(),
  },
  {
    id: "sr9",
    promptId: "sample-3",
    platform: "gemini",
    cited: true,
    citationPosition: 2,
    responseText:
      "For ecommerce stores, Klaviyo and Mailchimp are popular email marketing platforms offering automation and segmentation tools.",
    checkedAt: new Date(Date.now() - 14_400_000).toISOString(),
  },
];

export function computeGeoStats(results: GeoResult[]) {
  const byKey = new Map<string, GeoResult>();
  for (const r of [...results].sort(
    (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
  )) {
    const key = `${r.promptId}:${r.platform}`;
    if (!byKey.has(key)) byKey.set(key, r);
  }
  const latest = Array.from(byKey.values());

  const citedResults = latest.filter((r) => r.cited);
  const overallRate =
    latest.length > 0 ? Math.round((citedResults.length / latest.length) * 100) : 0;

  const positions = citedResults
    .map((r) => r.citationPosition)
    .filter((p): p is number => p !== null);
  const avgPosition =
    positions.length > 0
      ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1)
      : null;

  const byPlatform = Object.fromEntries(
    ALL_PLATFORMS.map((p) => [p, { cited: 0, total: 0, avgPosition: null as string | null }])
  ) as Record<GeoPlatform, { cited: number; total: number; avgPosition: string | null }>;

  for (const r of latest) {
    byPlatform[r.platform].total++;
    if (r.cited) byPlatform[r.platform].cited++;
  }
  for (const p of ALL_PLATFORMS) {
    const pos = latest
      .filter((r) => r.platform === p && r.cited && r.citationPosition !== null)
      .map((r) => r.citationPosition as number);
    if (pos.length > 0) {
      byPlatform[p].avgPosition = (pos.reduce((a, b) => a + b, 0) / pos.length).toFixed(1);
    }
  }

  return { overallRate, totalChecks: latest.length, citedCount: citedResults.length, avgPosition, byPlatform };
}

export function getPromptStats(
  promptId: string,
  platforms: GeoPlatform[],
  results: GeoResult[]
) {
  const byKey = new Map<string, GeoResult>();
  for (const r of results
    .filter((r) => r.promptId === promptId)
    .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())) {
    if (!byKey.has(r.platform)) byKey.set(r.platform, r);
  }
  const latest = Array.from(byKey.values());
  const cited = latest.filter((r) => r.cited).length;
  const total = latest.length;
  const rate = total > 0 ? Math.round((cited / total) * 100) : 0;
  const lastChecked = latest.reduce<string | null>((acc, r) => {
    if (!acc || new Date(r.checkedAt) > new Date(acc)) return r.checkedAt;
    return acc;
  }, null);

  const byPlatform = Object.fromEntries(
    platforms.map((p) => [p, byKey.get(p) ?? null])
  ) as Record<GeoPlatform, GeoResult | null>;

  return { cited, total, rate, lastChecked, byPlatform };
}
