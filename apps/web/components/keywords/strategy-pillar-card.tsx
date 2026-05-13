"use client";

import { Bookmark, Crown, DollarSign, TrendingUp } from "lucide-react";
import { KdBadge } from "@/components/keywords/kd-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMetric, type StrategyPillar } from "@/lib/keywords";

interface Props {
  pillar: StrategyPillar;
  onSave: (keyword: string) => void;
}

export function StrategyPillarCard({ pillar, onSave }: Props) {
  return (
    <Card className="overflow-hidden border-amber-300 bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50 dark:border-amber-900/50 dark:from-amber-950/30 dark:via-yellow-950/30 dark:to-amber-950/30">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Crown className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Pillar Keyword</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSave(pillar.keyword)}
            className="border-amber-300 bg-white/60 text-amber-700 hover:bg-white dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
          >
            <Bookmark className="mr-1.5 h-3.5 w-3.5" />
            Save to List
          </Button>
        </div>

        <h3 className="text-2xl font-bold tracking-tight">{pillar.keyword}</h3>

        <div className="flex flex-wrap items-center gap-3">
          <Metric icon={<TrendingUp className="h-3.5 w-3.5" />} label="Volume" value={formatMetric(pillar.volume)} />
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-xs text-muted-foreground">KD</span>
            <KdBadge value={pillar.kd} />
          </div>
          <Metric icon={<DollarSign className="h-3.5 w-3.5" />} label="CPC" value={`$${pillar.cpc.toFixed(2)}`} />
        </div>

        {pillar.rationale && (
          <p className="border-t border-amber-200/60 pt-3 text-sm italic text-muted-foreground dark:border-amber-900/40">
            {pillar.rationale}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}
