export const KEYWORD_METRICS_DDL = `
CREATE TABLE IF NOT EXISTS keyword_metrics_history (
  keyword_id          String,
  keyword             String,
  volume              UInt32,
  cpc                 Float32,
  keyword_difficulty  UInt8,
  recorded_at         Date
) ENGINE = MergeTree()
ORDER BY (keyword_id, recorded_at);
`;

export interface KeywordMetricsRow {
  keyword_id: string;
  keyword: string;
  volume: number;
  cpc: number;
  keyword_difficulty: number;
  recorded_at: string; // YYYY-MM-DD
}
