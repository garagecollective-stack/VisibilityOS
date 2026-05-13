import { cn } from "@/lib/utils";
import { scoreColor } from "@/components/shared/circular-score";

interface MiniProgressProps {
  label: string;
  value: number | null;
  className?: string;
}

export function MiniProgress({ label, value, className }: MiniProgressProps) {
  const v = value ?? 0;
  const color = scoreColor(value);
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums" style={{ color }}>
          {value === null ? "—" : v}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(0, Math.min(100, v))}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
