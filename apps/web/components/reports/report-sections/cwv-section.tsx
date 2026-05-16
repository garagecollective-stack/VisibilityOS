import { ReportSection } from "./executive-summary";
import type { ReportData } from "../types";

interface Props { data: ReportData["cwv"] }

function MetricRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-semibold tabular-nums text-sm">{value}</span>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${good ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {good ? "PASS" : "FAIL"}
        </span>
      </div>
    </div>
  );
}

export function CwvSection({ data }: Props) {
  if (!data || (data.mobileScore == null && data.lcp_ms == null)) {
    return <ReportSection title="Core Web Vitals"><p className="text-sm text-muted-foreground">No PageSpeed data available. Run an audit to collect CWV data.</p></ReportSection>;
  }

  const lcpOk = data.lcp_ms != null && data.lcp_ms <= 2500;
  const clsOk = data.cls != null && data.cls <= 0.1;
  const mobileOk = data.mobileScore != null && data.mobileScore >= 70;

  return (
    <ReportSection title="Core Web Vitals">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-muted-foreground mb-3">Performance Scores</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Mobile Score</span>
              <span className={`font-bold tabular-nums ${(data.mobileScore ?? 0) >= 80 ? "text-green-600" : (data.mobileScore ?? 0) >= 50 ? "text-orange-500" : "text-red-500"}`}>
                {data.mobileScore ?? "—"}/100
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Desktop Score</span>
              <span className={`font-bold tabular-nums ${(data.desktopScore ?? 0) >= 80 ? "text-green-600" : (data.desktopScore ?? 0) >= 50 ? "text-orange-500" : "text-red-500"}`}>
                {data.desktopScore ?? "—"}/100
              </span>
            </div>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-3">Core Metrics</p>
          <MetricRow label="LCP" value={data.lcp_ms != null ? `${(data.lcp_ms / 1000).toFixed(1)}s` : "—"} good={lcpOk} />
          <MetricRow label="CLS" value={data.cls != null ? data.cls.toFixed(3) : "—"} good={clsOk} />
          <MetricRow label="Performance" value={data.mobileScore != null ? `${data.mobileScore}/100` : "—"} good={mobileOk} />
        </div>
      </div>
    </ReportSection>
  );
}
