"use client";

import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { Delta, SC, SemWidget, Sparkline, ViewReport } from "./sem-widget";

// Deterministic sample sparkline — varies by seed so each metric looks different
function genSparkline(seed: number, length = 14): number[] {
  const data: number[] = [];
  let val = 35 + (seed * 17) % 40;
  for (let i = 0; i < length; i++) {
    val += (((seed * (i + 1) * 31 + 97) % 13) - 6) * 1.2;
    val = Math.max(5, Math.min(95, val));
    data.push(Math.round(val * 10) / 10);
  }
  return data;
}

interface MetricColProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  delta?: number | null;
  deltaInvert?: boolean;
  deltaSuffix?: string;
  sparkData: number[];
  sparkColor: string;
  valueColor?: string;
}

function MetricCol({
  label,
  value,
  sub,
  delta,
  deltaInvert,
  deltaSuffix,
  sparkData,
  sparkColor,
  valueColor = SC.text,
}: MetricColProps) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <p className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: SC.muted }}>
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: valueColor }}>
        {value}
      </p>
      {delta != null && (
        <Delta value={delta} suffix={deltaSuffix} invert={deltaInvert} />
      )}
      {sub && <p className="text-[11px]" style={{ color: SC.muted }}>{sub}</p>}
      <div className="mt-1.5">
        <Sparkline data={sparkData} color={sparkColor} />
      </div>
    </div>
  );
}

interface Props {
  domainAuthority: number | null;
  referringDomains: number | null;
  referringDomainsDelta: number | null;
  totalBacklinks: number | null;
  trackedKeywords: number;
  isSample: boolean;
}

export function DomainAnalyticsWidget({
  domainAuthority,
  referringDomains,
  referringDomainsDelta,
  totalBacklinks,
  trackedKeywords,
  isSample,
}: Props) {
  return (
    <SemWidget
      title="Domain Analytics"
      accentColor={SC.purple}
      headerRight={isSample ? <SampleDataBadge /> : undefined}
      footer={<ViewReport href="/dashboard/backlinks" label="View domain report" />}
    >
      <div className="flex items-start divide-x" style={{ "--tw-divide-opacity": "1" } as React.CSSProperties}>
        {/* col 1 */}
        <div className="flex-1 pr-4">
          <MetricCol
            label="Authority Score"
            value={domainAuthority ?? "—"}
            sub={domainAuthority != null ? "DataForSEO Rank" : undefined}
            sparkData={genSparkline(1)}
            sparkColor={SC.purple}
            valueColor={SC.purple}
          />
        </div>
        {/* col 2 */}
        <div className="flex-1 px-4">
          <MetricCol
            label="Organic Traffic"
            value="2.8K"
            delta={12.4}
            sparkData={genSparkline(2)}
            sparkColor={SC.blue}
            valueColor={SC.blue}
          />
        </div>
        {/* col 3 */}
        <div className="flex-1 px-4">
          <MetricCol
            label="Organic Keywords"
            value="180"
            delta={8.1}
            sparkData={genSparkline(3)}
            sparkColor={SC.green}
          />
        </div>
        {/* col 4 */}
        <div className="flex-1 px-4">
          <MetricCol
            label="Tracked Keywords"
            value={trackedKeywords}
            delta={trackedKeywords > 0 ? 12 : null}
            deltaSuffix=""
            sparkData={genSparkline(4)}
            sparkColor={SC.orange}
          />
        </div>
        {/* col 5 */}
        <div className="flex-1 pl-4">
          <MetricCol
            label="Referring Domains"
            value={referringDomains ?? "—"}
            delta={referringDomainsDelta}
            deltaSuffix=""
            sub={totalBacklinks != null ? `${totalBacklinks.toLocaleString()} backlinks` : undefined}
            sparkData={genSparkline(5)}
            sparkColor={SC.pink}
          />
        </div>
      </div>
    </SemWidget>
  );
}
