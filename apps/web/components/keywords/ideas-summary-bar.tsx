"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMetric, type KeywordRow } from "@/lib/keywords";
import { cn } from "@/lib/utils";

interface Props {
  total: number;
  visible: number;
  rows: KeywordRow[];
  onExportAll: () => void;
  onExportFiltered: () => void;
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

export function IdeasSummaryBar({
  total,
  visible,
  rows,
  onExportAll,
  onExportFiltered,
}: Props) {
  const avgVolume = avg(rows.map((r) => r.search_volume));
  const avgKd = avg(rows.map((r) => r.keyword_difficulty));
  const avgCpc = avg(rows.map((r) => r.cpc));
  const lowComp = rows.filter((r) => (r.keyword_difficulty ?? 100) < 30).length;
  const isFiltered = visible !== total;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold">
            {total.toLocaleString()} keyword ideas found
          </p>
          {isFiltered && (
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground">{visible.toLocaleString()}</span> after filters
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            label="Low Competition"
            value={lowComp.toLocaleString()}
            valueClassName="text-green-600 dark:text-green-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExportAll}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export All CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onExportFiltered}
            disabled={!isFiltered}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export Filtered CSV
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
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", valueClassName)}>{value}</span>
    </div>
  );
}
