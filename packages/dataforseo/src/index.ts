export { DataForSEOClient, makeCacheKey, withCache } from "./client.js";
export { KeywordsClient, CACHE_TTL_KEYWORDS } from "./keywords.js";
export { SerpClient, CACHE_TTL_SERP } from "./serp.js";
export { OnPageClient } from "./onpage.js";
export { BacklinksClient, CACHE_TTL_BACKLINKS } from "./backlinks.js";
export { LabsClient, CACHE_TTL_DOMAIN_METRICS } from "./labs.js";
export * from "./types.js";

// ─── Assembled DataForSEO facade ──────────────────────────────────────────────

import type { DataForSEOConfig, CacheConfig } from "./types.js";
import { DataForSEOClient } from "./client.js";
import { KeywordsClient } from "./keywords.js";
import { SerpClient } from "./serp.js";
import { OnPageClient } from "./onpage.js";
import { BacklinksClient } from "./backlinks.js";
import { LabsClient } from "./labs.js";

export interface DataForSEOOptions extends DataForSEOConfig {
  cache?: CacheConfig;
}

export class DataForSEO {
  public readonly keywords: KeywordsClient;
  public readonly serp: SerpClient;
  public readonly onpage: OnPageClient;
  public readonly backlinks: BacklinksClient;
  public readonly labs: LabsClient;

  constructor(options: DataForSEOOptions) {
    const httpClient = new DataForSEOClient(options);
    this.keywords = new KeywordsClient(httpClient, options.cache);
    this.serp = new SerpClient(httpClient, options.cache);
    this.onpage = new OnPageClient(httpClient);
    this.backlinks = new BacklinksClient(httpClient, options.cache);
    this.labs = new LabsClient(httpClient, options.cache);
  }
}
