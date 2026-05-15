import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  trend?: { value: number; suffix?: string } | null;
  tooltip?: React.ReactNode;
  hint?: string;
  sampleData?: boolean;
  accent?: "default" | "green" | "yellow" | "red" | "blue" | "purple";
  className?: string;
}

const ACCENT_ICON_BG: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  default: "bg-muted text-muted-foreground",
  green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
  yellow: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
  red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
};

export function MetricCard({
  label,
  value,
  icon,
  trend,
  tooltip,
  hint,
  sampleData,
  accent = "default",
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden card-shadow hover:card-shadow-hover transition-shadow",
        className
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", ACCENT_ICON_BG[accent])}>
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <span className="text-xs font-medium text-muted-foreground leading-tight block truncate">{label}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            {tooltip && <InfoTooltip content={tooltip} />}
            {sampleData && <SampleDataBadge />}
          </div>
        </div>
        <div className="text-2xl font-bold tabular-nums tracking-tight">{value}</div>
        {(trend || hint) && (
          <div className="flex items-center gap-2 text-xs">
            {trend && <TrendPill value={trend.value} suffix={trend.suffix} />}
            {hint && <span className="text-muted-foreground">{hint}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrendPill({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-medium text-muted-foreground">
        <Minus className="h-3 w-3" />
        0{suffix}
      </span>
    );
  }
  const positive = value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium",
        positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
      )}
    >
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {positive ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}
