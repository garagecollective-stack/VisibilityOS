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
      const res = await this.client.post<{ items?: Array<{ keyword_data: KeywordSuggestion }> }>(
        "/v3/dataforseo_labs/google/keyword_suggestions/live",
        [params]
      );
      // result[0] is the seed wrapper { seed_keyword, items: [{keyword_data: {...}}] }
      const resultObj = res.tasks[0]?.result?.[0];
      console.log("RAW RESPONSE result[0] keys:", Object.keys(resultObj ?? {}));
      console.log("RAW RESPONSE first item:", JSON.stringify(resultObj?.items?.[0], null, 2));
      return (resultObj?.items ?? [])
        .map((item) => item.keyword_data)
        .filter((kd): kd is KeywordSuggestion => kd != null);
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
    const params = { keyword, location_code: locationCode, language_code: languageCode };

    const fetcher = async () => {
      const res = await this.client.post<KeywordIdea>(
        "/v3/dataforseo_labs/google/keyword_ideas/live",
        [params]
      );
      return res.tasks[0]?.result ?? [];
    };

    if (this.cache) {
      const key = makeCacheKey("labs/keyword_ideas", params);
      return withCache(this.cache, key, CACHE_TTL_KEYWORDS, fetcher);
    }
    return fetcher();
  }
}
