import { InfoTooltip } from "@/components/shared/info-tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Severity = "critical" | "warning" | "notice";
type Category =
  | "meta"
  | "links"
  | "speed"
  | "content"
  | "schema"
  | "mobile"
  | "security"
  | "indexing"
  | "cwv";

interface Issue {
  severity: Severity;
  category: Category;
}

const GROUPS: Array<{
  key: string;
  label: string;
  categories: Category[];
  tooltip: string;
}> = [
  {
    key: "technical",
    label: "Technical",
    categories: ["meta", "links", "indexing", "schema", "mobile"],
    tooltip: "Meta tags, links, indexing directives, structured data, and mobile readiness.",
  },
  {
    key: "content",
    label: "Content",
    categories: ["content"],
    tooltip: "Thin content and outbound link quality.",
  },
  {
    key: "speed",
    label: "Speed",
    categories: ["speed", "cwv"],
    tooltip: "Server response time, image weight, and Core Web Vitals.",
  },
  {
    key: "security",
    label: "Security",
    categories: ["security"],
    tooltip: "HTTPS enforcement and security-related headers.",
  },
];

function computeScore(issues: Issue[]): number {
  const criticals = issues.filter((i) => i.severity === "critical").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const notices = issues.filter((i) => i.severity === "notice").length;
  const raw = 100 - criticals * 5 - warnings * 2 - notices * 0.5;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function scoreColor(score: number): string {
  if (score >= 90) return "#22c55e";
  if (score >= 70) return "#3b82f6";
  if (score >= 50) return "#eab308";
  return "#ef4444";
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Work";
  return "Critical";
}

export function ScoreBreakdown({ issues }: { issues: Issue[] }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Score Breakdown
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {GROUPS.map((group) => {
          const groupIssues = issues.filter((i) => group.categories.includes(i.category));
          const score = computeScore(groupIssues);
          const color = scoreColor(score);
          const critical = groupIssues.filter((i) => i.severity === "critical").length;
          const warnings = groupIssues.filter((i) => i.severity === "warning").length;

          return (
            <Card key={group.key}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <span>{group.label}</span>
                    <InfoTooltip content={group.tooltip} />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>
                    {scoreLabel(score)}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums" style={{ color }}>
                    {score}
                  </span>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${score}%`, backgroundColor: color }}
                  />
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span
                    className={cn(
                      "tabular-nums",
                      critical > 0 ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"
                    )}
                  >
                    {critical} critical
                  </span>
                  <span
                    className={cn(
                      "tabular-nums",
                      warnings > 0
                        ? "font-semibold text-yellow-600 dark:text-yellow-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {warnings} warnings
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
