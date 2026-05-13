import type { KeywordRow } from "./keywords";

export function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

export function exportKeywordsToCSV(filename: string, keywords: KeywordRow[]): void {
  const header = ["Keyword", "Search Volume", "KD", "CPC", "Intent", "Competition"];
  const body = keywords.map((kw) => [
    kw.keyword,
    String(kw.search_volume),
    kw.keyword_difficulty != null ? String(kw.keyword_difficulty) : "",
    kw.cpc.toFixed(2),
    kw.intent,
    kw.competition != null ? kw.competition.toFixed(2) : kw.competition_level ?? "",
  ]);
  downloadCsv(filename, [header, ...body]);
}
