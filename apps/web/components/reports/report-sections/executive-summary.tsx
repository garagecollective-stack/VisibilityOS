import { CheckCircle2, XCircle } from "lucide-react";
import type { ReportData } from "../types";

interface Props { data: ReportData["executiveSummary"] }

export function ExecutiveSummarySection({ data }: Props) {
  if (!data) {
    return (
      <ReportSection title="Executive Summary">
        <p className="text-sm text-muted-foreground">No summary available.</p>
      </ReportSection>
    );
  }

  return (
    <ReportSection title="Executive Summary">
      <p className="text-sm leading-relaxed mb-4">{data.overview}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.wins.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-2">Key Wins</p>
            <ul className="space-y-1.5">
              {data.wins.map((win, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                  <span>{win}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.issues.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-2">Priority Issues</p>
            <ul className="space-y-1.5">
              {data.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ReportSection>
  );
}

export function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="report-section rounded-lg border bg-white p-6 break-inside-avoid">
      <h2 className="text-base font-bold mb-4 pb-2 border-b">{title}</h2>
      {children}
    </div>
  );
}
