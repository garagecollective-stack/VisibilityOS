import type { DataForSEOClient } from "./client.js";
import { makeCacheKey, withCache } from "./client.js";
import type { BacklinkSummary, BacklinkItem, CacheConfig } from "./types.js";

export const CACHE_TTL_BACKLINKS = 43_200; // 12 hours

export class BacklinksClient {
  constructor(
    private readonly client: DataForSEOClient,
    private readonly cache?: CacheConfig
  ) {}

  async getDomainSummary(domain: string): Promise<BacklinkSummary | null> {
    const fetcher = async () => {
      const res = await this.client.post<BacklinkSummary>("/v3/backlinks/summary/live", [
        {
          target: domain,
          include_subdomains: true,
          include_indirect_links: true,
          exclude_internal_backlinks: true,
        },
      ]);
      return (res.tasks[0]?.result?.[0] as BacklinkSummary | undefined) ?? null;
    };

    if (this.cache) {
      const key = makeCacheKey("backlinks/summary", { domain });
      return withCache(this.cache, key, CACHE_TTL_BACKLINKS, fetcher);
    }
    return fetcher();
  }

  async getBacklinks(
    domain: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<BacklinkItem[]> {
    const params = { domain, limit, offset };

    const fetcher = async () => {
      const res = await this.client.post<{ items: BacklinkItem[] }>("/v3/backlinks/backlinks/live", [
        {
          target: domain,
          limit,
          offset,
          include_subdomains: true,
          exclude_internal_backlinks: true,
          filters: [["dofollow", "=", true]],
          order_by: ["rank,desc"],
        },
      ]);
      const result = res.tasks[0]?.result?.[0] as { items?: BacklinkItem[] } | undefined;
      return result?.items ?? [];
    };

    if (this.cache) {
      const key = makeCacheKey("backlinks/backlinks", params);
      return withCache(this.cache, key, CACHE_TTL_BACKLINKS, fetcher);
    }
    return fetcher();
  }

  async getNewLostBacklinks(
    domain: string,
    dateFrom: string,
    dateTo: string
  ): Promise<{ new: BacklinkItem[]; lost: BacklinkItem[] }> {
    const [newRes, lostRes] = await Promise.all([
      this.client.post<{ items: BacklinkItem[] }>("/v3/backlinks/backlinks/live", [
        {
          target: domain,
          limit: 100,
          filters: [
            ["is_new", "=", true],
            "and",
            ["first_seen", ">=", dateFrom],
          ],
        },
      ]),
      this.client.post<{ items: BacklinkItem[] }>("/v3/backlinks/backlinks/live", [
        {
          target: domain,
          limit: 100,
          include_lost_backlinks: true,
          filters: [["is_lost", "=", true]],
        },
      ]),
    ]);

    const newItems = (newRes.tasks[0]?.result?.[0] as { items?: BacklinkItem[] } | undefined)?.items ?? [];
    const lostItems = (lostRes.tasks[0]?.result?.[0] as { items?: BacklinkItem[] } | undefined)?.items ?? [];

    return { new: newItems, lost: lostItems };
  }
}
