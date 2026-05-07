export const TRAFFIC_DDL = `
CREATE TABLE IF NOT EXISTS traffic_estimates (
  project_id         String,
  estimated_traffic  UInt32,
  visibility_score   Float32,
  organic_keywords   UInt32,
  date               Date
) ENGINE = MergeTree()
ORDER BY (project_id, date);
`;

export interface TrafficEstimateRow {
  project_id: string;
  estimated_traffic: number;
  visibility_score: number;
  organic_keywords: number;
  date: string; // YYYY-MM-DD
}
