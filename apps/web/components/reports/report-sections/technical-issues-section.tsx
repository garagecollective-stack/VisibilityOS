import { ReportSection } from "./executive-summary";
import type { ReportData } from "../types";

interface Props { data: ReportData["technicalIssues"] }

function IssueRow({ title, description, recommendation, affectedCount, severity }: {
  title: string; description: string; recommendation: string; affectedCount: number;
  severity: "critical" | "warning";
}) {
  return (
    <div className="py-3 border-b last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className={`mt-0.5 shrink-0 h-2 w-2 rounded-full ${severity === "critical" ? "bg-red-500" : "bg-orange-400"}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            <p className="text-xs mt-1"><span className="font-medium">Fix: </span>{recommendation}</p>
          </div>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{affectedCount} page{affectedCount !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

export function TechnicalIssuesSection({ data }: Props) {
  if (!data) {
    return <ReportSection title="Technical Issues"><p className="text-sm text-muted-foreground">No audit data available.</p></ReportSection>;
  }

  return (
    <ReportSection title="Technical Issues">
      {data.critical.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-2">Critical ({data.critical.length})</p>
          {data.critical.map((issue, i) => (
            <IssueRow key={i} {...issue} severity="critical" />
          ))}
        </div>
      )}
      {data.warnings.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-2">Warnings ({data.warnings.length})</p>
          {data.warnings.map((issue, i) => (
            <IssueRow key={i} {...issue} severity="warning" />
          ))}
        </div>
      )}
      {data.critical.length === 0 && data.warnings.length === 0 && (
        <p className="text-sm text-green-600 font-medium">No significant issues found. 🎉</p>
      )}
    </ReportSection>
  );
}
