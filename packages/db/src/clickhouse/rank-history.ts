export const RANK_HISTORY_DDL = `
CREATE TABLE IF NOT EXISTS rank_history (
  project_id   String,
  keyword_id   String,
  keyword      String,
  position     UInt16,
  previous_position UInt16,
  url          String,
  serp_features Array(String),
  location_code UInt32,
  device       String,
  checked_at   DateTime
) ENGINE = MergeTree()
ORDER BY (project_id, keyword_id, checked_at)
PARTITION BY toYYYYMM(checked_at);
`;

export interface RankHistoryRow {
  project_id: string;
  keyword_id: string;
  keyword: string;
  position: number;
  previous_position: number;
  url: string;
  serp_features: string[];
  location_code: number;
  device: string;
  checked_at: Date;
}
