export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export interface GSCSearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCTopPage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GA4MetricValue {
  oneValue: string;
}

export interface GA4DimensionValue {
  value: string;
}

export interface GA4Row {
  dimensionValues: GA4DimensionValue[];
  metricValues: GA4MetricValue[];
}

export interface PageSpeedResult {
  url: string;
  strategy: "mobile" | "desktop";
  performance_score: number;
  lcp: number;       // ms
  fid: number;       // ms
  cls: number;       // score
  fcp: number;       // ms
  speed_index: number;
  tbt: number;       // ms
  tti: number;       // ms
  opportunities: PageSpeedOpportunity[];
  diagnostics: PageSpeedDiagnostic[];
}

export interface PageSpeedOpportunity {
  id: string;
  title: string;
  description: string;
  savings_ms: number;
  savings_bytes: number;
}

export interface PageSpeedDiagnostic {
  id: string;
  title: string;
  description: string;
  score: number | null;
  display_value: string | null;
}
