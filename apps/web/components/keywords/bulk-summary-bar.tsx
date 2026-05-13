"use client";

import { Bookmark, Download, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMetric, type KeywordBulkRow } from "@/lib/keywords";
import { cn } from "@/lib/utils";

interface Props {
  rows: KeywordBulkRow[];
  onExportAll: () => void;
  onSaveAll: () => void;
}

function avg(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function kdColor(value: number | null): string {
  if (value === null) return "text-muted-foreground";
  if (value < 30) return "text-green-600 dark:text-green-400";
  if (value < 70) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export function BulkSummaryBar({ rows, onExportAll, onSaveAll }: Props) {
  const total = rows.length;
  const avgVolume = avg(rows.map((r) => r.search_volume));
  const avgKd = avg(rows.map((r) => r.keyword_difficulty));
  const avgCpc = avg(rows.map((r) => r.cpc));
  const highVolume = rows.filter((r) => r.search_volume > 10_000).length;
  const lowKd = rows.filter((r) => (r.keyword_difficulty ?? 100) < 30).length;
  const opportunities = rows.filter(
    (r) => r.search_volume > 1_000 && (r.keyword_difficulty ?? 100) < 40
  ).length;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <StatChip label="Total Keywords" value={total.toLocaleString()} />
          <StatChip
            label="Avg Volume"
            value={avgVolume !== null ? formatMetric(Math.round(avgVolume)) : "—"}
          />
          <StatChip
            label="Avg KD"
            value={avgKd !== null ? Math.round(avgKd).toString() : "—"}
            valueClassName={kdColor(avgKd !== null ? Math.round(avgKd) : null)}
          />
          <StatChip
            label="Avg CPC"
            value={avgCpc !== null ? `$${avgCpc.toFixed(2)}` : "—"}
          />
          <StatChip
            label="High Volume"
            value={highVolume.toLocaleString()}
            badgeClassName="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          />
          <StatChip
            label="Low KD"
            value={lowKd.toLocaleString()}
            badgeClassName="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          />
          <StatChip
            label="Opportunities"
            value={opportunities.toLocaleString()}
            badgeClassName="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
            icon={<Star className="h-3 w-3 fill-current" />}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExportAll}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export All CSV
          </Button>
          <Button size="sm" onClick={onSaveAll}>
            <Bookmark className="mr-1.5 h-3.5 w-3.5" />
            Save All to List
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatChip({
  label,
  value,
  valueClassName,
  badgeClassName,
  icon,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  badgeClassName?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5",
        badgeClassName && "border-transparent"
      )}
    >
      {icon && (
        <span
          className={cn("flex h-4 w-4 items-center justify-center", badgeClassName && "")}
        >
          {icon}
        </span>
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          badgeClassName,
          !badgeClassName && valueClassName,
          badgeClassName && "rounded-full px-2 py-0.5"
        )}
      >
        {value}
      </span>
    </div>
  );
}
