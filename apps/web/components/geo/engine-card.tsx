import { cn } from "@/lib/utils";
import { ENGINE_CONFIG, type GeoPlatform } from "@/lib/geo";

interface EngineCardProps {
  platform: GeoPlatform;
  citedCount: number;
  totalChecks: number;
  avgPosition: string | null;
}

export function EngineCard({ platform, citedCount, totalChecks, avgPosition }: EngineCardProps) {
  const cfg = ENGINE_CONFIG[platform];
  const rate = totalChecks > 0 ? Math.round((citedCount / totalChecks) * 100) : 0;

  return (
    <div className={cn("rounded-xl border p-4 space-y-3", cfg.cardBg)}>
      <div className="flex items-center justify-between">
        <span className={cn("text-sm font-semibold", cfg.textColor)}>{cfg.label}</span>
        <span className={cn("text-2xl font-bold tabular-nums", cfg.textColor)}>{rate}%</span>
      </div>
      <div className="space-y-1.5">
        <div className="h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", cfg.barColor)}
            style={{ width: `${rate}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {citedCount}/{totalChecks} {totalChecks === 1 ? "check" : "checks"} cited
          </span>
          {avgPosition !== null && <span>Avg pos. #{avgPosition}</span>}
          {totalChecks === 0 && <span className="italic">No data yet</span>}
        </div>
      </div>
    </div>
  );
}
