export const GSC_METRICS_DDL = `
CREATE TABLE IF NOT EXISTS gsc_metrics
(
  project_id   String,
  keyword      String,
  page         String,
  clicks       UInt32,
  impressions  UInt32,
  ctr          Float64,
  position     Float64,
  date         Date,
  synced_at    DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(synced_at)
ORDER BY (project_id, date, keyword, page)
PARTITION BY toYYYYMM(date)
`;
