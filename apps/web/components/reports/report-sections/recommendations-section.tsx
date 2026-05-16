import { ReportSection } from "./executive-summary";
import type { ReportData } from "../types";

interface Props { data: ReportData["recommendations"] }

const PRIORITY_STYLES = {
  high: { badge: "bg-red-100 text-red-700", label: "High" },
  medium: { badge: "bg-orange-100 text-orange-700", label: "Medium" },
  low: { badge: "bg-blue-100 text-blue-700", label: "Low" },
} as const;

export function RecommendationsSection({ data }: Props) {
  if (!data || data.length === 0) {
    return <ReportSection title="Recommendations"><p className="text-sm text-muted-foreground">No recommendations available.</p></ReportSection>;
  }

  return (
    <ReportSection title="Recommendations">
      <div className="space-y-3">
        {data.map((rec, i) => {
          const style = PRIORITY_STYLES[rec.priority] ?? PRIORITY_STYLES.medium;
          return (
            <div key={i} className="flex gap-3 py-3 border-b last:border-0">
              <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${style.badge}`}>{style.label}</span>
                </div>
                <p className="text-sm font-medium">{rec.action}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Expected impact: {rec.impact}</p>
              </div>
            </div>
          );
        })}
      </div>
    </ReportSection>
  );
}
