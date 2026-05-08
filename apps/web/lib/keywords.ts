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

export interface StrategyGroup {
  subtopic: string;
  keywords: KeywordBulkRow[];
}

export interface KeywordStrategyResult {
  pillarKeywords: KeywordBulkRow[];
  supportingKeywords: StrategyGroup[];
  quickWins: KeywordBulkRow[];
}

export interface KeywordListItem {
  id: string;
  keywordId: string;
  listId: string;
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
  { label: "India", value: "2356" },
  { label: "USA", value: "2840" },
  { label: "UK", value: "2826" },
  { label: "Global", value: "0" },
] as const;

export function formatMetric(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}
