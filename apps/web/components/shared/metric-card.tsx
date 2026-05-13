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

const ACCENT_ICON: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  default: "text-muted-foreground",
  green: "text-green-600 dark:text-green-400",
  yellow: "text-yellow-600 dark:text-yellow-400",
  red: "text-red-600 dark:text-red-400",
  blue: "text-blue-600 dark:text-blue-400",
  purple: "text-purple-600 dark:text-purple-400",
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
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {icon && <span className={ACCENT_ICON[accent]}>{icon}</span>}
            <span>{label}</span>
            {tooltip && <InfoTooltip content={tooltip} />}
          </div>
          {sampleData && <SampleDataBadge />}
        </div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
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
