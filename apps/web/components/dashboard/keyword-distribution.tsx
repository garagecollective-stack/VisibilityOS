"use client";

import { Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { cn } from "@/lib/utils";

const BUCKETS: Array<{ key: string; label: string; color: string; bg: string }> = [
  { key: "top3",    label: "Top 3",    color: "#22c55e", bg: "bg-green-500"  },
  { key: "p4_10",   label: "4–10",     color: "#3b82f6", bg: "bg-blue-500"   },
  { key: "p11_20",  label: "11–20",    color: "#eab308", bg: "bg-yellow-500" },
  { key: "p21_50",  label: "21–50",    color: "#f97316", bg: "bg-orange-500" },
  { key: "p51_100", label: "51–100",   color: "#ef4444", bg: "bg-red-500"    },
  { key: "p100plus",label: "100+",     color: "#94a3b8", bg: "bg-slate-400"  },
];

const SAMPLE: Record<string, number> = {
  top3: 8, p4_10: 22, p11_20: 31, p21_50: 19, p51_100: 12, p100plus: 8,
};

interface Props {
  distribution: Record<string, number>;
  isSample?: boolean;
}

export function KeywordDistributionCard({ distribution, isSample = false }: Props) {
  const data = isSample ? SAMPLE : distribution;
  const total = Object.values(data).reduce((s, n) => s + n, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Keywords by Position</CardTitle>
        </div>
        {isSample && <SampleDataBadge />}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stacked bar */}
        {total > 0 && (
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            {BUCKETS.map((b) => {
              const count = data[b.key] ?? 0;
              const pct = (count / total) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={b.key}
                  className={cn("h-full transition-[width] duration-500", b.bg)}
                  style={{ width: `${pct}%` }}
                  title={`${b.label}: ${count}`}
                />
              );
            })}
          </div>
        )}

        {/* Legend rows */}
        <div className="space-y-2">
          {BUCKETS.map((b) => {
            const count = data[b.key] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={b.key} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: b.color }}
                />
                <span className="w-14 text-muted-foreground">{b.label}</span>
                <div className="flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full transition-[width] duration-500"
                    style={{ width: `${pct}%`, backgroundColor: b.color }}
                  />
                </div>
                <span className="w-10 text-right tabular-nums font-medium">{count}</span>
                <span className="w-9 text-right tabular-nums text-muted-foreground">{pct}%</span>
              </div>
            );
          })}
        </div>

        {total > 0 && (
          <p className="text-xs text-muted-foreground">
            {total} keywords tracked across all position buckets
          </p>
        )}
      </CardContent>
    </Card>
  );
}
