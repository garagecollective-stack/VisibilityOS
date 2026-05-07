import { z } from "zod";

// ─── Base Response ─────────────────────────────────────────────────────────────

export const DataForSEOTaskSchema = z.object({
  id: z.string(),
  status_code: z.number(),
  status_message: z.string(),
  time: z.string(),
  cost: z.number(),
  result_count: z.number(),
  path: z.array(z.string()),
  data: z.unknown().optional(),
  result: z.array(z.unknown()).optional(),
});

export const DataForSEOResponseSchema = z.object({
  version: z.string(),
  status_code: z.number(),
  status_message: z.string(),
  time: z.string(),
  cost: z.number(),
  tasks_count: z.number(),
  tasks_error: z.number(),
  tasks: z.array(DataForSEOTaskSchema),
});

export type DataForSEOResponse<T = unknown> = {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data?: unknown;
    result?: T[];
  }>;
};

// ─── Keyword Types ─────────────────────────────────────────────────────────────

export interface KeywordSuggestion {
  keyword: string;
  location_code: number;
  language_code: string;
  search_volume: number;
  competition: number;
  competition_level: string;
  cpc: number;
  keyword_difficulty: number | null;
  keyword_properties: {
    core_keyword: string | null;
    synonym_clustering_algorithm: string | null;
    keyword_difficulty: number;
    detected_language: string | null;
    is_another_encoding: boolean;
  } | null;
  impressions_etv: number;
  estimated_paid_clicks: number;
  refined_keyword_properties: unknown | null;
  relevant_serps_count: number | null;
  serp_info: unknown | null;
  avg_backlinks_info: {
    se_type: string;
    backlinks: number;
    dofollow: number;
    referring_pages: number;
    referring_domains: number;
    referring_main_domains: number;
    rank: number;
    main_domain_rank: number;
    last_updated_time: string;
  } | null;
  serp_item_types: string[];
  monthly_searches: Array<{
    year: number;
    month: number;
    search_volume: number;
  }> | null;
}

export interface BulkVolumeItem {
  keyword: string;
  location_code: number;
  language_code: string;
  search_volume: number;
  competition: number;
  competition_level: string;
  cpc: number;
  monthly_searches: Array<{
    year: number;
    month: number;
    search_volume: number;
  }> | null;
}

export interface BulkKdItem {
  keyword: string;
  keyword_difficulty: number;
  location_code: number;
  language_code: string;
}

export interface KeywordIdea {
  keyword: string;
  location_code: number;
  language_code: string;
  search_volume: number;
  competition: number;
  competition_level: string;
  cpc: number;
  keyword_difficulty: number | null;
  serp_item_types: string[];
  monthly_searches: Array<{
    year: number;
    month: number;
    search_volume: number;
  }> | null;
}

// ─── SERP Types ────────────────────────────────────────────────────────────────

export interface SerpOrganicItem {
  type: string;
  rank_group: number;
  rank_absolute: number;
  domain: string;
  title: string;
  description: string;
  url: string;
  breadcrumb: string;
  website_name: string;
  is_image: boolean;
  is_video: boolean;
  is_featured_snippet: boolean;
  is_malicious: boolean;
  is_web_story: boolean;
  amp_version: boolean;
  rating: unknown | null;
  highlighted: string[] | null;
  links: unknown | null;
  about_this_result: unknown | null;
  related_search_url: string | null;
  timestamp: string;
  rectangle: unknown | null;
  xpath: string;
}

export interface SerpResult {
  keyword: string;
  type: string;
  se_domain: string;
  location_code: number;
  language_code: string;
  check_url: string;
  datetime: string;
  spell: unknown | null;
  refinement_chips: unknown | null;
  item_types: string[];
  se_results_count: number;
  last_updated_time: string;
  items_count: number;
  items: SerpOrganicItem[];
}

export interface SerpTaskInfo {
  taskId: string;
  status: "queued" | "in_queue" | "processing" | "ready" | "failed";
}

// ─── OnPage / Audit Types ──────────────────────────────────────────────────────

export type IssueSeverity = "critical" | "warning" | "notice";

export interface OnPageIssue {
  id: string;
  check_id: string;
  title: string;
  description: string;
  category: string;
  relevance: number;
  severity: IssueSeverity;
  pages_count: number;
  pages_crawled_count: number;
}

export interface OnPagePage {
  url: string;
  status_code: number;
  location: string | null;
  meta: {
    title: string | null;
    description: string | null;
    htags: Record<string, string[]> | null;
    canonical: string | null;
    robots: string | null;
    charset: string | null;
    follow: boolean;
    index: boolean;
    generator: string | null;
    og_title: string | null;
    og_description: string | null;
    og_url: string | null;
    og_image: string | null;
    og_locale: string | null;
    og_type: string | null;
    twitter_card: string | null;
  };
  page_timing: {
    time_to_interactive: number | null;
    dom_complete: number | null;
    largest_contentful_paint: number | null;
    first_input_delay: number | null;
    cumulative_layout_shift: number | null;
    speed_index: number | null;
    time_to_first_byte: number | null;
    waiting_time: number | null;
    downloading_time: number | null;
    duration_time: number | null;
    fetch_start: number | null;
    fetch_end: number | null;
  };
  content: {
    plain_text_size: number;
    plain_text_rate: number;
    plain_text_word_count: number;
    automated_readability_index: number | null;
    coleman_liau_readability_index: number | null;
    dale_chall_readability_score: number | null;
    flesch_kincaid_readability_tests: {
      reading_ease: number | null;
      grade_level: number | null;
    } | null;
    calculated_reading_time: number | null;
    sentences_count: number;
    paragraphs_count: number;
    images: number;
    images_without_alt: number;
  };
  checks: Record<string, boolean | string | number | null>;
}

export interface OnPageSummary {
  domain: string;
  crawl_progress: string;
  crawl_status: {
    max_crawl_pages: number;
    pages_in_queue: number;
    pages_crawled: number;
  };
  page_not_found_status_sums: {
    pages: number;
  };
  checks: Record<string, { issues_count: number; relevant_pages_count: number }>;
  duplicate_tags: {
    title: {
      duplicate_tags_count: number;
      groups_count: number;
    };
    description: {
      duplicate_tags_count: number;
      groups_count: number;
    };
  };
  broken_links: {
    total: number;
    internal: number;
    external: number;
  };
}

// ─── Backlink Types ────────────────────────────────────────────────────────────

export interface BacklinkSummary {
  target: string;
  index_from: string;
  backlinks: number;
  backlinks_spam_score: number;
  broken_backlinks: number;
  broken_pages: number;
  referring_domains: number;
  referring_domains_nofollow: number;
  referring_main_domains: number;
  referring_main_domains_nofollow: number;
  referring_ips: number;
  referring_subnets: number;
  referring_pages: number;
  referring_links_tld: Record<string, number>;
  referring_links_types: Record<string, number>;
  referring_links_attributes: Record<string, number>;
  referring_links_platform_types: Record<string, number>;
  referring_links_semantic_locations: Record<string, number>;
  referring_links_countries: Record<string, number>;
  rank: number;
  main_domain_rank: number;
  last_visited_error_at: string | null;
}

export interface BacklinkItem {
  type: string;
  domain_from: string;
  url_from: string;
  url_from_https: boolean;
  domain_to: string;
  url_to: string;
  url_to_https: boolean;
  tld_from: string;
  is_new: boolean;
  is_lost: boolean;
  page_from_rank: number;
  domain_from_rank: number;
  domain_from_platform_type: string[];
  domain_from_is_ip: boolean;
  domain_from_ip: string | null;
  page_from_external_links_count: number | null;
  page_from_internal_links_count: number | null;
  page_from_size: number | null;
  page_from_encoding: string | null;
  page_from_language: string | null;
  page_from_title: string | null;
  page_from_status_code: number | null;
  first_seen: string | null;
  prev_seen: string | null;
  last_seen: string | null;
  item_type: string;
  attributes: string[];
  dofollow: boolean;
  original: boolean;
  alt: string | null;
  anchor: string | null;
  text_pre: string | null;
  text_post: string | null;
  semantic_location: string | null;
  links_count: number | null;
  group_count: number | null;
  is_broken: boolean;
  url_to_status_code: number | null;
  url_to_spam_score: number | null;
  url_to_redirect_target: string | null;
  ranked_keywords_info: unknown | null;
  is_indirect_link: boolean | null;
}

// ─── Labs / Competitor Types ───────────────────────────────────────────────────

export interface DomainMetrics {
  target: string;
  metrics: {
    organic: {
      pos_1: number;
      pos_2_3: number;
      pos_4_10: number;
      pos_11_20: number;
      pos_21_30: number;
      pos_31_40: number;
      pos_41_50: number;
      pos_51_60: number;
      pos_61_70: number;
      pos_71_80: number;
      pos_81_90: number;
      pos_91_100: number;
      etv: number;
      impressions_etv: number;
      count: number;
      estimated_paid_traffic_cost: number;
      is_new: number;
      is_up: number;
      is_down: number;
      is_lost: number;
    };
    paid: {
      pos_1: number;
      pos_2_3: number;
      pos_4_10: number;
      pos_11_20: number;
      pos_21_30: number;
      pos_31_40: number;
      pos_41_50: number;
      pos_51_60: number;
      pos_61_70: number;
      pos_71_80: number;
      pos_81_90: number;
      pos_91_100: number;
      etv: number;
      impressions_etv: number;
      count: number;
      estimated_paid_traffic_cost: number;
      is_new: number;
      is_up: number;
      is_down: number;
      is_lost: number;
    };
  };
}

export interface CompetitorDomain {
  domain: string;
  avg_position: number;
  sum_position: number;
  intersections: number;
  full_domain_metrics: DomainMetrics;
  metrics: DomainMetrics["metrics"];
  competitor_metrics: DomainMetrics["metrics"];
}

// ─── Client Config ─────────────────────────────────────────────────────────────

export interface DataForSEOConfig {
  login: string;
  password: string;
  baseUrl?: string;
  maxRetries?: number;
  requestsPerMinute?: number;
}

export interface CacheConfig {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttlSeconds: number) => Promise<void>;
}
