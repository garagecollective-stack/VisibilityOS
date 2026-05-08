import type { DataForSEOClient } from "./client.js";
import { makeCacheKey, withCache } from "./client.js";
import type { KeywordSuggestion, BulkVolumeItem, KeywordIdea, CacheConfig } from "./types.js";

export const CACHE_TTL_KEYWORDS = 86_400; // 24 hours

export class KeywordsClient {
  constructor(
    private readonly client: DataForSEOClient,
    private readonly cache?: CacheConfig
  ) {}

  async getSuggestions(
    keyword: string,
    locationCode: number,
    languageCode: string
  ): Promise<KeywordSuggestion[]> {
    const params = { keyword, location_code: locationCode, language_code: languageCode };

    const fetcher = async () => {
      const res = await this.client.post<{
        items?: Array<{
          keyword: string;
          location_code: number;
          language_code: string;
          keyword_info?: {
            search_volume?: number | null;
            competition?: number | null;
            competition_level?: string | null;
            cpc?: number | null;
            monthly_searches?: Array<{ year: number; month: number; search_volume: number }> | null;
          } | null;
          keyword_properties?: {
            core_keyword: string | null;
            synonym_clustering_algorithm: string | null;
            keyword_difficulty: number;
            detected_language: string | null;
            is_another_encoding: boolean;
          } | null;
          impressions_etv?: number | null;
          estimated_paid_clicks?: number | null;
          relevant_serps_count?: number | null;
          avg_backlinks_info?: KeywordSuggestion["avg_backlinks_info"];
          serp_info?: unknown | null;
          serp_item_types?: string[] | null;
        }>;
      }>(
        "/v3/dataforseo_labs/google/keyword_suggestions/live",
        [params]
      );
      const resultObj = res.tasks[0]?.result?.[0];
      return (resultObj?.items ?? [])
        .filter((item) => item?.keyword != null)
        .map((item): KeywordSuggestion => ({
          keyword: item.keyword,
          location_code: item.location_code,
          language_code: item.language_code,
          search_volume: item.keyword_info?.search_volume ?? 0,
          competition: item.keyword_info?.competition ?? 0,
          competition_level: item.keyword_info?.competition_level ?? "UNKNOWN",
          cpc: item.keyword_info?.cpc ?? 0,
          keyword_difficulty: item.keyword_properties?.keyword_difficulty ?? null,
          keyword_properties: item.keyword_properties ?? null,
          impressions_etv: item.impressions_etv ?? 0,
          estimated_paid_clicks: item.estimated_paid_clicks ?? 0,
          refined_keyword_properties: null,
          relevant_serps_count: item.relevant_serps_count ?? null,
          serp_info: item.serp_info ?? null,
          avg_backlinks_info: item.avg_backlinks_info ?? null,
          serp_item_types: item.serp_item_types ?? [],
          monthly_searches: item.keyword_info?.monthly_searches ?? null,
        }));
    };

    if (this.cache) {
      const key = makeCacheKey("labs/keyword_suggestions", params);
      return withCache(this.cache, key, CACHE_TTL_KEYWORDS, fetcher);
    }
    return fetcher();
  }

  async getBulkVolume(
    keywords: string[],
    locationCode: number,
    languageCode: string
  ): Promise<BulkVolumeItem[]> {
    const params = { keywords, location_code: locationCode, language_code: languageCode };

    const fetcher = async () => {
      const res = await this.client.post<BulkVolumeItem>(
        "/v3/keywords_data/google_ads/search_volume/live",
        [params]
      );
      return res.tasks[0]?.result ?? [];
    };

    if (this.cache) {
      const key = makeCacheKey("keywords_data/search_volume", params);
      return withCache(this.cache, key, CACHE_TTL_KEYWORDS, fetcher);
    }
    return fetcher();
  }

  async getKeywordIdeas(
    keyword: string,
    locationCode: number,
    languageCode: string
  ): Promise<KeywordIdea[]> {
    const params = {
      keywords: [keyword],
      location_code: Number.parseInt(String(locationCode), 10),
      language_code: languageCode,
      limit: 100,
      include_serp_info: false,
    };

    const fetcher = async () => {
      console.log("[DataForSEO] keyword ideas payload:", JSON.stringify([params]));
      const res = await this.client.post<{
        items?: Array<{
          keyword: string;
          location_code: number;
          language_code: string;
          keyword_info?: {
            search_volume?: number | null;
            competition?: number | null;
            competition_level?: string | null;
            cpc?: number | null;
            keyword_difficulty?: number | null;
            monthly_searches?: Array<{
              year: number;
              month: number;
              search_volume: number;
            }> | null;
          } | null;
          serp_info?: {
            serp_item_types?: string[] | null;
          } | null;
        }>;
      }>(
        "/v3/dataforseo_labs/google/keyword_ideas/live",
        [params]
      );
      const items = res.tasks[0]?.result?.[0]?.items ?? [];
      return items.map((item) => ({
        keyword: item.keyword,
        location_code: item.location_code,
        language_code: item.language_code,
        search_volume: item.keyword_info?.search_volume ?? 0,
        competition: item.keyword_info?.competition ?? 0,
        competition_level: item.keyword_info?.competition_level ?? "UNKNOWN",
        cpc: item.keyword_info?.cpc ?? 0,
        keyword_difficulty: item.keyword_info?.keyword_difficulty ?? null,
        serp_item_types: item.serp_info?.serp_item_types ?? [],
        monthly_searches: item.keyword_info?.monthly_searches ?? null,
      }));
    };

    if (this.cache) {
      const key = makeCacheKey("labs/keyword_ideas", params);
      return withCache(this.cache, key, CACHE_TTL_KEYWORDS, fetcher);
    }
    return fetcher();
  }
}
