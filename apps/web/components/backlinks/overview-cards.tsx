"use client";

import type { ElementType } from "react";
import type { OverviewData } from "./types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link2, Globe2, Zap, TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  delta?: number | null;
  description?: string;
  icon: ElementType;
}

function MetricCard({ title, value, delta, description, icon: Icon }: MetricCardProps) {
  return (
    <Card className="card-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
            {delta != null && (
              <p className={`mt-1 text-xs flex items-center gap-0.5 font-medium ${delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                {delta >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {delta >= 0 ? "+" : ""}{delta.toLocaleString()} vs last month
              </p>
            )}
            {description && delta == null && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0 ml-3">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface Props {
  data: OverviewData | null;
  isLoading: boolean;
}

export function OverviewCards({ data, isLoading }: Props) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  const netChange = data.newBacklinks30d - data.lostBacklinks30d;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total Backlinks"
        value={data.totalBacklinks.toLocaleString()}
        delta={data.totalBacklinksDelta}
        icon={Link2}
      />
      <MetricCard
        title="Referring Domains"
        value={data.referringDomains.toLocaleString()}
        delta={data.referringDomainsDelta}
        icon={Globe2}
      />
      <MetricCard
        title="Domain Rank"
        value={String(data.domainRank)}
        description="Score 0–100"
        icon={Zap}
      />
      <MetricCard
        title="New Backlinks (30d)"
        value={`+${data.newBacklinks30d}`}
        delta={netChange}
        icon={TrendingUp}
      />
    </div>
  );
}
