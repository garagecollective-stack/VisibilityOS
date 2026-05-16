import { ReportSection } from "./executive-summary";
import type { ReportData } from "../types";

interface Props { data: ReportData["aiSearch"] }

const BOT_LABELS: Record<string, string> = {
  chatgpt_user: "ChatGPT-User",
  oai_searchbot: "OAI-SearchBot",
  gptbot: "GPTBot",
  google_extended: "Google-Extended",
  perplexitybot: "PerplexityBot",
  claudebot: "ClaudeBot",
};

export function AiSearchSection({ data }: Props) {
  if (!data) {
    return <ReportSection title="AI Search Visibility"><p className="text-sm text-muted-foreground">No AI search data available.</p></ReportSection>;
  }

  const color = data.score >= 80 ? "text-green-600" : data.score >= 50 ? "text-orange-500" : "text-red-500";

  return (
    <ReportSection title="AI Search Visibility">
      <div className="flex items-center gap-6 mb-4">
        <div className="text-center">
          <p className={`text-4xl font-bold tabular-nums ${color}`}>{data.score}</p>
          <p className="text-xs text-muted-foreground">/100</p>
        </div>
        <div>
          <p className="text-sm font-medium">{data.llmsTxtFound ? "✅ llms.txt found" : "❌ llms.txt missing"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.llmsTxtFound ? "AI crawlers can discover your content catalog" : "Add /llms.txt to help AI crawlers index your content"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(BOT_LABELS).map(([key, label]) => {
          const status = data.botAccess[key] ?? "unknown";
          return (
            <div key={key} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="text-xs">{label}</span>
              <span className={`text-xs font-semibold ${status === "allowed" ? "text-green-600" : status === "blocked" ? "text-red-500" : "text-muted-foreground"}`}>
                {status === "allowed" ? "Allowed" : status === "blocked" ? "Blocked" : "Unknown"}
              </span>
            </div>
          );
        })}
      </div>
    </ReportSection>
  );
}
