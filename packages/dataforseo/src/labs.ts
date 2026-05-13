import type { DataForSEOClient } from "./client.js";
import { makeCacheKey, withCache } from "./client.js";
import type { DomainMetrics, CompetitorDomain, BulkKdItem, CacheConfig } from "./types.js";

export const CACHE_TTL_DOMAIN_METRICS = 86_400; // 24 hours

export class LabsClient {
  constructor(
    private readonly client: DataForSEOClient,
    private readonly cache?: CacheConfig
  ) {}

  async getDomainMetrics(domain: string, locationCode: number): Promise<DomainMetrics | null> {
    const params = { domain, location_code: locationCode };

    const fetcher = async () => {
      const res = await this.client.post<DomainMetrics>(
        "/v3/dataforseo_labs/google/domain_metrics_by_categories/live",
        [
          {
            target: domain,
            location_code: locationCode,
            language_code: "en",
          },
        ]
      );
      return (res.tasks[0]?.result?.[0] as DomainMetrics | undefined) ?? null;
    };

    if (this.cache) {
      const key = makeCacheKey("labs/domain_metrics", params);
      return withCache(this.cache, key, CACHE_TTL_DOMAIN_METRICS, fetcher);
    }
    return fetcher();
  }

  async getCompetitorDomains(
    domain: string,
    locationCode: number,
    limit: number = 10
  ): Promise<CompetitorDomain[]> {
    const params = { domain, location_code: locationCode, limit };

    const fetcher = async () => {
      const res = await this.client.post<{ items: CompetitorDomain[] }>(
        "/v3/dataforseo_labs/google/competitors_domain/live",
        [
          {
            target: domain,
            location_code: locationCode,
            language_code: "en",
            limit,
            filters: [["metrics.organic.count", ">", 0]],
            order_by: ["metrics.organic.etv,desc"],
          },
        ]
      );
      const result = res.tasks[0]?.result?.[0] as { items?: CompetitorDomain[] } | undefined;
      return result?.items ?? [];
    };

    if (this.cache) {
      const key = makeCacheKey("labs/competitors_domain", params);
      return withCache(this.cache, key, CACHE_TTL_DOMAIN_METRICS, fetcher);
    }
    return fetcher();
  }

  async getBulkKeywordDifficulty(
    keywords: string[],
    locationCode: number,
    languageCode: string
  ): Promise<BulkKdItem[]> {
    const params = { keywords, location_code: locationCode, language_code: languageCode };

    const fetcher = async () => {
      const res = await this.client.post<BulkKdItem | { items: BulkKdItem[] }>(
        "/v3/dataforseo_labs/google/bulk_keyword_difficulty/live",
        [params]
      );
      const result = res.tasks[0]?.result;
      if (!result || result.length === 0) return [];
      // Some DataForSEO Labs endpoints wrap items under result[0].items;
      // others return items directly in the result array.
      const first = result[0] as unknown as { items?: BulkKdItem[] } | BulkKdItem;
      if (first && "items" in first && Array.isArray(first.items)) {
        return first.items;
      }
      return result as unknown as BulkKdItem[];
    };

    if (this.cache) {
      const key = makeCacheKey("labs/bulk_keyword_difficulty", params);
      return withCache(this.cache, key, 86_400, fetcher);
    }
    return fetcher();
  }

  async getBulkDomainMetrics(
    domains: string[],
    locationCode: number
  ): Promise<DomainMetrics[]> {
    const res = await this.client.post<DomainMetrics>(
      "/v3/dataforseo_labs/google/bulk_traffic_estimation/live",
      domains.map((domain) => ({ target: domain, location_code: locationCode, language_code: "en" }))
    );
    return (res.tasks[0]?.result as DomainMetrics[] | undefined) ?? [];
  }
}
