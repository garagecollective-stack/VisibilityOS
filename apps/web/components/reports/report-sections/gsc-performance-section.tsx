import { ReportSection } from "./executive-summary";
import type { ReportData } from "../types";

interface Props { data: ReportData["gsc"] }

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3 text-center">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function GscPerformanceSection({ data }: Props) {
  if (!data) {
    return (
      <ReportSection title="GSC Performance">
        <p className="text-sm text-muted-foreground">No GSC data available. Connect Google Search Console to see performance data.</p>
      </ReportSection>
    );
  }

  return (
    <ReportSection title="GSC Performance">
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Clicks" value={fmt(data.totalClicks)} />
        <StatCard label="Impressions" value={fmt(data.totalImpressions)} />
        <StatCard label="Avg CTR" value={`${data.avgCtr.toFixed(1)}%`} />
        <StatCard label="Avg Position" value={data.avgPosition.toFixed(1)} />
      </div>
      {data.topPages.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Top Pages by Clicks</p>
          <div className="space-y-1">
            {data.topPages.map((page, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0 text-xs">
                <span className="truncate flex-1 mr-3 text-blue-600">{page.page}</span>
                <span className="shrink-0 text-muted-foreground">{fmt(page.clicks)} clicks</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ReportSection>
  );
}
