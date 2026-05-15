"use client";

import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMetric } from "@/lib/keywords";
import { cn } from "@/lib/utils";

interface CompetitorData {
  id: string;
  domain: string;
  organicKeywords: number | null;
  organicTraffic: number | null;
  domainRank: number | null;
  commonKeywords: number | null;
  lastFetchedAt: string | null;
}

interface Props {
  data: CompetitorData;
  isYou?: boolean;
  onRemove?: (id: string) => void;
  loading?: boolean;
  className?: string;
}

function Metric({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">
        {value ?? <span className="text-muted-foreground/60">—</span>}
      </p>
    </div>
  );
}

export function CompetitorCard({ data, isYou, onRemove, loading, className }: Props) {
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${data.domain}&sz=32`;

  const lastUpdated = data.lastFetchedAt
    ? new Date(data.lastFetchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <Card className={cn("relative overflow-hidden transition-shadow hover:shadow-md", className)}>
      {!isYou && onRemove && (
        <button
          type="button"
          onClick={() => onRemove(data.id)}
          className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-destructive"
          title="Remove competitor"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      <CardContent className="p-4 pt-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={faviconUrl} alt="" className="h-5 w-5 rounded-sm" />
          <span className="text-sm font-semibold truncate flex-1">{data.domain}</span>
          {isYou && (
            <Badge variant="default" className="text-[10px] bg-blue-600 hover:bg-blue-600 shrink-0">
              You
            </Badge>
          )}
        </div>

        {/* Metrics 2x2 grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Metric
              label="Organic Keywords"
              value={data.organicKeywords != null ? formatMetric(data.organicKeywords) : null}
            />
            <Metric
              label="Est. Traffic"
              value={data.organicTraffic != null ? formatMetric(data.organicTraffic) : null}
            />
            <Metric
              label="Domain Rank"
              value={data.domainRank != null ? String(data.domainRank) : null}
            />
            <Metric
              label="Common Keywords"
              value={data.commonKeywords != null ? formatMetric(data.commonKeywords) : null}
            />
          </div>
        )}

        {lastUpdated && (
          <p className="text-[10px] text-muted-foreground/60">Updated {lastUpdated}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function CompetitorCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 pt-5 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-sm" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
