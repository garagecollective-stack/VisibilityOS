import { cn } from "@/lib/utils";

type Level = "LOW" | "MEDIUM" | "HIGH";

interface Props {
  value: number | null | undefined;
  level?: string | null;
  className?: string;
}

const STYLES: Record<Level, string> = {
  LOW: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function deriveLevel(value: number | null | undefined, level?: string | null): Level | null {
  if (level === "LOW" || level === "MEDIUM" || level === "HIGH") return level;
  if (value === null || value === undefined) return null;
  if (value < 0.34) return "LOW";
  if (value < 0.67) return "MEDIUM";
  return "HIGH";
}

const LABEL: Record<Level, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

export function CompetitionBadge({ value, level, className }: Props) {
  const resolved = deriveLevel(value, level);
  if (!resolved) {
    return <span className="text-xs text-muted-foreground">N/A</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        STYLES[resolved],
        className
      )}
    >
      {LABEL[resolved]}
    </span>
  );
}
