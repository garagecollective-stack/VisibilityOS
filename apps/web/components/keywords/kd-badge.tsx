import { cn } from "@/lib/utils";

interface KdBadgeProps {
  value: number | null;
  className?: string;
}

export function KdBadge({ value, className }: KdBadgeProps) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground text-xs">N/A</span>;
  }
  const color =
    value < 30
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : value <= 70
        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tabular-nums",
        color,
        className
      )}
    >
      {value}
    </span>
  );
}
