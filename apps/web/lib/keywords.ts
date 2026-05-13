export type MonthlyPoint = {
  year: number;
  month: number;
  search_volume: number;
};

export interface KeywordRow {
  keyword: string;
  search_volume: number;
  cpc: number;
  keyword_difficulty: number | null;
  intent: string;
  monthly_searches: MonthlyPoint[];
  competition?: number | null;
  competition_level?: string | null;
  serp_item_types?: string[];
}

export interface KeywordOverviewResult {
  main: KeywordRow;
  related: KeywordRow[];
}

export interface KeywordIdeaResult {
  ideas: KeywordRow[];
}

export interface KeywordBulkRow extends KeywordRow {
  competition: number | null;
}

export interface KeywordBulkResult {
  results: KeywordBulkRow[];
}

export interface StrategyPillar {
  keyword: string;
  volume: number;
  kd: number;
  cpc: number;
  rationale: string;
}

export interface StrategyClusterPillarPage {
  keyword: string;
  volume: number;
  kd: number;
  content_type: string;
}

export interface StrategySupportingKeyword {
  keyword: string;
  volume: number;
  kd: number;
  is_quick_win: boolean;
}

export interface StrategyCluster {
  topic: string;
  pillar_page: StrategyClusterPillarPage;
  supporting_keywords: StrategySupportingKeyword[];
}

export interface StrategyCalendarItem {
  week: number;
  content_type: string;
  keyword: string;
  estimated_volume: number;
  priority: "high" | "medium" | "low";
}

export interface KeywordStrategyResult {
  pillar: StrategyPillar;
  clusters: StrategyCluster[];
  content_calendar: StrategyCalendarItem[];
  summary: string;
}

export interface KeywordListItem {
  id: string;
  keywordId: string;
  listId: string;
  volume: number | null;
  kd: number | null;
  cpc: number | null;
  intent: string | null;
  keyword: {
    id: string;
    keyword: string;
    locationCode: string;
    languageCode: string;
    device: string;
    createdAt: string;
  };
}

export interface KeywordListRecord {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  projectDomain: string;
  lastEnrichedAt: string | null;
  createdAt: string;
  items: KeywordListItem[];
}

export interface KeywordListsResult {
  lists: KeywordListRecord[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  domain: string;
}

export const KEYWORD_LOCATIONS = [
  { label: "India", value: "2356", flag: "🇮🇳", code: "IN" },
  { label: "United States", value: "2840", flag: "🇺🇸", code: "US" },
  { label: "United Kingdom", value: "2826", flag: "🇬🇧", code: "GB" },
  { label: "UAE", value: "9041", flag: "🇦🇪", code: "AE" },
  { label: "Canada", value: "2124", flag: "🇨🇦", code: "CA" },
  { label: "Australia", value: "2036", flag: "🇦🇺", code: "AU" },
  { label: "Singapore", value: "2702", flag: "🇸🇬", code: "SG" },
] as const;

export type LocationCode = (typeof KEYWORD_LOCATIONS)[number]["value"];

export function locationByCountry(countryCode: string): (typeof KEYWORD_LOCATIONS)[number] {
  return (
    KEYWORD_LOCATIONS.find((location) => location.code === countryCode.toUpperCase()) ??
    KEYWORD_LOCATIONS[0]
  );
}

export function formatMetric(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export { downloadCsv, exportKeywordsToCSV } from "./export-csv";
