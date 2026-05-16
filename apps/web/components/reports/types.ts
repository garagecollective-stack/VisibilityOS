export interface ReportData {
  title: string;
  type: string;
  sections: string[];
  dateRange: string;
  generatedAt: string;
  project: { id: string; domain: string; name: string };
  executiveSummary?: {
    overview: string;
    wins: string[];
    issues: string[];
    actions: Array<{ priority: string; action: string; impact: string }>;
  };
  siteHealth?: {
    score: number;
    criticalIssues: number;
    warnings: number;
    notices: number;
    pagesCrawled: number;
    cwvScore: number | null;
    previousScore: number | null;
  };
  technicalIssues?: {
    critical: Array<{ title: string; description: string; recommendation: string; affectedCount: number }>;
    warnings: Array<{ title: string; description: string; recommendation: string; affectedCount: number }>;
    crawledPages: number;
  };
  cwv?: {
    mobileScore: number | null;
    desktopScore: number | null;
    lcp_ms: number | null;
    cls: number | null;
  };
  aiSearch?: {
    score: number;
    llmsTxtFound: boolean;
    botAccess: Record<string, string>;
  };
  keywords?: {
    total: number;
    top3: number;
    top10: number;
    top100: number;
    topKeywords: Array<{ keyword: string; position: number }>;
  };
  gsc?: {
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
    topPages: Array<{ page: string; clicks: number; impressions: number }>;
  };
  recommendations?: Array<{
    priority: "high" | "medium" | "low";
    action: string;
    impact: string;
  }>;
}
