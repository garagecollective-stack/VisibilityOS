import { ReportSection } from "./executive-summary";
import type { ReportData } from "../types";

interface Props { data: ReportData["keywords"] }

function DistBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function KeywordRankingsSection({ data }: Props) {
  if (!data || data.total === 0) {
    return <ReportSection title="Keyword Rankings"><p className="text-sm text-muted-foreground">No keyword data available.</p></ReportSection>;
  }

  return (
    <ReportSection title="Keyword Rankings">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-muted-foreground mb-3">Position Distribution</p>
          <div className="space-y-3">
            <DistBar label="Top 3" value={data.top3} total={data.total} color="#00C48C" />
            <DistBar label="Top 10" value={data.top10} total={data.total} color="#4285F4" />
            <DistBar label="Top 100" value={data.top100} total={data.total} color="#9CA3AF" />
          </div>
          <p className="text-xs text-muted-foreground mt-3">{data.total} total tracked keywords</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-3">Top Keywords</p>
          <div className="space-y-1">
            {data.topKeywords.slice(0, 10).map((kw, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b last:border-0 text-xs">
                <span className="truncate flex-1 mr-2">{kw.keyword}</span>
                <span className={`shrink-0 font-semibold tabular-nums px-1.5 py-0.5 rounded text-[10px] ${
                  kw.position <= 3 ? "bg-green-100 text-green-700" :
                  kw.position <= 10 ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-600"
                }`}>#{kw.position}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ReportSection>
  );
}
