"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { formatMetric } from "@/lib/keywords";
import { cn } from "@/lib/utils";

interface DomainBacklinks {
  domain: string;
  referringDomains: number;
  totalBacklinks: number;
  domainRank: number;
  newBacklinks: number;
  lostBacklinks: number;
}

interface Props {
  you: DomainBacklinks | null;
  competitor: DomainBacklinks | null;
  loading: boolean;
  isMock: boolean;
}

interface MetricRowProps {
  label: string;
  youValue: number;
  theirValue: number;
}

function MetricRow({ label, youValue, theirValue }: MetricRowProps) {
  const youWins = youValue >= theirValue;
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground w-36">{label}</span>
      <div className="flex items-center gap-6">
        <span className={cn("text-sm font-semibold tabular-nums w-20 text-right", youWins ? "text-green-600" : "text-foreground")}>
          {formatMetric(youValue)}
        </span>
        <span className="text-xs text-muted-foreground">vs</span>
        <span className={cn("text-sm font-semibold tabular-nums w-20 text-left", !youWins ? "text-red-500" : "text-foreground")}>
          {formatMetric(theirValue)}
        </span>
      </div>
    </div>
  );
}

function BarComparison({ label, youValue, theirValue }: { label: string; youValue: number; theirValue: number }) {
  const max = Math.max(youValue, theirValue, 1);
  const youPct = Math.round((youValue / max) * 100);
  const theirPct = Math.round((theirValue / max) * 100);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-xs w-6 text-right text-muted-foreground shrink-0">You</span>
          <div className="flex-1 bg-muted rounded-full h-2">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all duration-700"
              style={{ width: `${youPct}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums w-16 text-right">{formatMetric(youValue)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs w-6 text-right text-muted-foreground shrink-0">Them</span>
          <div className="flex-1 bg-muted rounded-full h-2">
            <div
              className="h-2 rounded-full bg-orange-500 transition-all duration-700"
              style={{ width: `${theirPct}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums w-16 text-right">{formatMetric(theirValue)}</span>
        </div>
      </div>
    </div>
  );
}

export function BacklinkComparison({ you, competitor, loading, isMock }: Props) {
  if (loading) {
    return (
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (!you || !competitor) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="font-medium text-muted-foreground">Backlink data unavailable</p>
      </div>
    );
  }

  const refDomainsDiff = competitor.referringDomains - you.referringDomains;

  return (
    <div className="space-y-6">
      {isMock && <SampleDataBadge />}

      {/* Side-by-side cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* You */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://www.google.com/s2/favicons?domain=${you.domain}&sz=16`} alt="" className="h-4 w-4 rounded-sm" />
            <span className="font-semibold text-sm">{you.domain}</span>
            <span className="ml-auto text-[10px] font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">You</span>
          </div>
          <div className="space-y-2">
            <MetricLine label="Referring Domains" value={you.referringDomains} wins={you.referringDomains >= competitor.referringDomains} />
            <MetricLine label="Total Backlinks" value={you.totalBacklinks} wins={you.totalBacklinks >= competitor.totalBacklinks} />
            <MetricLine label="Domain Rank" value={you.domainRank} wins={you.domainRank >= competitor.domainRank} />
            <MetricLine label="New (30d)" value={you.newBacklinks} wins={you.newBacklinks >= competitor.newBacklinks} isPositive />
          </div>
        </div>

        {/* Competitor */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://www.google.com/s2/favicons?domain=${competitor.domain}&sz=16`} alt="" className="h-4 w-4 rounded-sm" />
            <span className="font-semibold text-sm">{competitor.domain}</span>
          </div>
          <div className="space-y-2">
            <MetricLine label="Referring Domains" value={competitor.referringDomains} wins={competitor.referringDomains >= you.referringDomains} />
            <MetricLine label="Total Backlinks" value={competitor.totalBacklinks} wins={competitor.totalBacklinks >= you.totalBacklinks} />
            <MetricLine label="Domain Rank" value={competitor.domainRank} wins={competitor.domainRank >= you.domainRank} />
            <MetricLine label="New (30d)" value={competitor.newBacklinks} wins={competitor.newBacklinks >= you.newBacklinks} isPositive />
          </div>
        </div>
      </div>

      {/* Bar comparison */}
      <div className="rounded-lg border bg-card p-5 space-y-5">
        <BarComparison
          label="Referring Domains"
          youValue={you.referringDomains}
          theirValue={competitor.referringDomains}
        />
        <BarComparison
          label="Total Backlinks"
          youValue={you.totalBacklinks}
          theirValue={competitor.totalBacklinks}
        />
      </div>

      {/* Insight */}
      {refDomainsDiff > 0 ? (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
          They have <strong>{formatMetric(refDomainsDiff)} more referring domains</strong> than you.
          Focus on acquiring quality backlinks to close the gap.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground bg-green-50 dark:bg-green-950/20 rounded-lg px-4 py-3 text-green-700 dark:text-green-400">
          You have <strong>{formatMetric(Math.abs(refDomainsDiff))} more referring domains</strong> than this competitor.
          Keep building links to maintain your advantage.
        </p>
      )}
    </div>
  );
}

function MetricLine({ label, value, wins, isPositive }: { label: string; value: number; wins: boolean; isPositive?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", wins ? "text-green-600" : "text-red-500")}>
        {isPositive && wins ? "+" : ""}
        {formatMetric(value)}
      </span>
    </div>
  );
}
