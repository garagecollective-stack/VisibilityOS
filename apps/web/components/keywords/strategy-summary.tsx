import { Layers, ListChecks, Sparkles, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { KeywordStrategyResult } from "@/lib/keywords";
import { cn } from "@/lib/utils";

interface Props {
  strategy: KeywordStrategyResult;
}

function kdColor(value: number): string {
  if (value < 30) return "text-green-600 dark:text-green-400";
  if (value < 70) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export function StrategySummary({ strategy }: Props) {
  const totalKeywords =
    1 +
    strategy.clusters.reduce(
      (sum, c) => sum + 1 + c.supporting_keywords.length,
      0
    );
  const clusterCount = strategy.clusters.length;
  const quickWins = strategy.clusters.reduce(
    (sum, c) => sum + c.supporting_keywords.filter((k) => k.is_quick_win).length,
    0
  );

  const allKds: number[] = [
    strategy.pillar.kd,
    ...strategy.clusters.flatMap((c) => [
      c.pillar_page.kd,
      ...c.supporting_keywords.map((k) => k.kd),
    ]),
  ].filter((kd) => Number.isFinite(kd));
  const avgKd =
    allKds.length === 0 ? 0 : Math.round(allKds.reduce((s, n) => s + n, 0) / allKds.length);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <p className="text-sm text-foreground">{strategy.summary}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<ListChecks className="h-4 w-4" />} label="Total Keywords" value={totalKeywords.toLocaleString()} />
          <Stat icon={<Layers className="h-4 w-4" />} label="Clusters" value={clusterCount.toString()} />
          <Stat
            icon={<Sparkles className="h-4 w-4" />}
            label="Quick Wins"
            value={quickWins.toString()}
            valueClassName="text-green-600 dark:text-green-400"
          />
          <Stat
            icon={<Target className="h-4 w-4" />}
            label="Avg KD"
            value={avgKd.toString()}
            valueClassName={kdColor(avgKd)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="space-y-1 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn("text-xl font-bold tabular-nums", valueClassName)}>{value}</div>
    </div>
  );
}
