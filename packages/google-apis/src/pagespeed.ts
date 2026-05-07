import type { PageSpeedResult, PageSpeedOpportunity, PageSpeedDiagnostic } from "./types.js";

const PSI_BASE = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export class PageSpeedClient {
  constructor(private readonly apiKey: string) {}

  async analyze(url: string, strategy: "mobile" | "desktop" = "mobile"): Promise<PageSpeedResult> {
    const params = new URLSearchParams({
      url,
      strategy,
      key: this.apiKey,
      category: "performance",
    });

    const res = await fetch(`${PSI_BASE}?${params}`);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`PageSpeed API error ${res.status}: ${body}`);
    }

    const data = await res.json() as Record<string, unknown>;
    return this.parseResult(url, strategy, data);
  }

  async analyzeBoth(url: string): Promise<{ mobile: PageSpeedResult; desktop: PageSpeedResult }> {
    const [mobile, desktop] = await Promise.all([
      this.analyze(url, "mobile"),
      this.analyze(url, "desktop"),
    ]);
    return { mobile, desktop };
  }

  private parseResult(url: string, strategy: "mobile" | "desktop", data: Record<string, unknown>): PageSpeedResult {
    const cats = data["lighthouseResult"] as Record<string, unknown>;
    const audits = (cats["audits"] ?? {}) as Record<string, Record<string, unknown>>;
    const categories = (cats["categories"] ?? {}) as Record<string, Record<string, unknown>>;

    const getMetric = (id: string): number => {
      const audit = audits[id];
      return typeof audit?.["numericValue"] === "number" ? audit["numericValue"] : 0;
    };

    const opportunities: PageSpeedOpportunity[] = [];
    const diagnostics: PageSpeedDiagnostic[] = [];

    for (const [id, audit] of Object.entries(audits)) {
      if (audit["type"] === "opportunity") {
        opportunities.push({
          id,
          title: String(audit["title"] ?? ""),
          description: String(audit["description"] ?? ""),
          savings_ms: (audit["details"] as Record<string, number> | undefined)?.["overallSavingsMs"] ?? 0,
          savings_bytes: (audit["details"] as Record<string, number> | undefined)?.["overallSavingsBytes"] ?? 0,
        });
      } else if (audit["type"] === "diagnostic" || audit["type"] === "informative") {
        diagnostics.push({
          id,
          title: String(audit["title"] ?? ""),
          description: String(audit["description"] ?? ""),
          score: typeof audit["score"] === "number" ? audit["score"] : null,
          display_value: typeof audit["displayValue"] === "string" ? audit["displayValue"] : null,
        });
      }
    }

    return {
      url,
      strategy,
      performance_score: Math.round(((categories["performance"]?.["score"] as number | undefined) ?? 0) * 100),
      lcp: getMetric("largest-contentful-paint"),
      fid: getMetric("max-potential-fid"),
      cls: getMetric("cumulative-layout-shift"),
      fcp: getMetric("first-contentful-paint"),
      speed_index: getMetric("speed-index"),
      tbt: getMetric("total-blocking-time"),
      tti: getMetric("interactive"),
      opportunities,
      diagnostics,
    };
  }
}
