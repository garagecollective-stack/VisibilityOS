import { ReportSection } from "./executive-summary";
import type { ReportData } from "../types";

interface Props { data: ReportData["siteHealth"] }

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 80 ? "#00C48C" : score >= 50 ? "#FF8C00" : "#F34E4E";
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={96} height={96} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={48} cy={48} r={r} fill="none" stroke="#F0F0F5" strokeWidth={8} />
        <circle cx={48} cy={48} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

export function SiteHealthSection({ data }: Props) {
  if (!data) {
    return <ReportSection title="Site Health"><p className="text-sm text-muted-foreground">No audit data available.</p></ReportSection>;
  }

  const delta = data.previousScore != null ? Math.round(data.score - data.previousScore) : null;

  return (
    <ReportSection title="Site Health">
      <div className="flex items-center gap-8">
        <ScoreCircle score={Math.round(data.score)} />
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Overall Score</span>
            {delta != null && (
              <span className={`text-xs font-semibold ${delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)} vs last audit
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 mt-2">
            {[
              { label: "Critical", value: data.criticalIssues, color: "text-red-600" },
              { label: "Warnings", value: data.warnings, color: "text-orange-500" },
              { label: "Notices", value: data.notices, color: "text-blue-500" },
            ].map((item) => (
              <div key={item.label} className="rounded-md bg-muted/40 p-3 text-center">
                <p className={`text-xl font-bold tabular-nums ${item.color}`}>{item.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{data.pagesCrawled.toLocaleString()} pages crawled</p>
        </div>
      </div>
    </ReportSection>
  );
}
