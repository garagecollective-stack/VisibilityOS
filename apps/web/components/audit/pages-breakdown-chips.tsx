import { cn } from "@/lib/utils";

export interface PagesBreakdown {
  total: number;
  healthy: number;
  has_issues: number;
  broken: number;
  redirects: number;
  blocked: number;
}

const CHIPS: Array<{
  key: keyof Omit<PagesBreakdown, "total">;
  label: string;
  dot: string;
  chip: string;
}> = [
  {
    key: "healthy",
    label: "Healthy",
    dot: "bg-green-500",
    chip: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
  },
  {
    key: "has_issues",
    label: "Has Issues",
    dot: "bg-orange-500",
    chip: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800",
  },
  {
    key: "broken",
    label: "Broken",
    dot: "bg-red-500",
    chip: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  },
  {
    key: "redirects",
    label: "Redirects",
    dot: "bg-blue-500",
    chip: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  },
  {
    key: "blocked",
    label: "Blocked",
    dot: "bg-gray-500",
    chip: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  },
];

export function PagesBreakdownChips({ breakdown }: { breakdown: PagesBreakdown }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CHIPS.map((chip) => (
        <span
          key={chip.key}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
            chip.chip
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", chip.dot)} />
          <span className="tabular-nums font-semibold">{breakdown[chip.key]}</span>
          <span>{chip.label}</span>
        </span>
      ))}
      <span className="inline-flex items-center rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
        <span className="tabular-nums font-semibold mr-1">{breakdown.total}</span>
        Total
      </span>
    </div>
  );
}
