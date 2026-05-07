"use client";
import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Search, TrendingUp, DollarSign, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KdBadge } from "@/components/keywords/kd-badge";
import { IntentBadge } from "@/components/keywords/intent-badge";
import { Sparkline } from "@/components/keywords/sparkline";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

type MonthlyPoint = { year: number; month: number; search_volume: number };

interface KeywordData {
  keyword: string;
  search_volume: number;
  cpc: number;
  keyword_difficulty: number | null;
  intent: string;
  monthly_searches: MonthlyPoint[];
}

interface RelatedKeyword extends KeywordData {}

interface OverviewResult {
  main: KeywordData;
  related: RelatedKeyword[];
}

type SortKey = keyof Omit<RelatedKeyword, "monthly_searches">;
type SortDir = "asc" | "desc";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function KeywordOverviewPage() {
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OverviewResult | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("search_volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const search = useCallback(async (kw: string) => {
    if (!kw.trim()) return;
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const data = await apiClient<OverviewResult>("/keywords/overview", {
        method: "POST",
        body: JSON.stringify({ keyword: kw.trim(), locationCode: 2356, languageCode: "en" }),
        token: token ?? undefined,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedRelated = result
    ? [...(result.related ?? [])].sort((a, b) => {
        const av = a[sortKey] ?? -1;
        const bv = b[sortKey] ?? -1;
        const cmp = typeof av === "string" ? av.localeCompare(String(bv)) : Number(av) - Number(bv);
        return sortDir === "asc" ? cmp : -cmp;
      })
    : [];

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      <span className="ml-1 text-xs">{sortDir === "asc" ? "↑" : "↓"}</span>
    ) : (
      <span className="ml-1 text-xs opacity-30">↕</span>
    );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Enter a keyword to analyze…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Searching…" : "Analyze"}
        </Button>
      </form>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Enter any keyword above to see search volume, difficulty, and trends.</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-lg border bg-muted" />
            ))}
          </div>
          <div className="h-48 rounded-lg border bg-muted" />
          <div className="h-64 rounded-lg border bg-muted" />
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Main keyword metrics */}
          <div className="rounded-lg border bg-card p-5 space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-bold">{result.main.keyword}</h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <IntentBadge intent={result.main.intent} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Search Volume"
                value={fmt(result.main.search_volume)}
              />
              <MetricCard
                icon={<DollarSign className="h-4 w-4" />}
                label="CPC"
                value={`$${result.main.cpc.toFixed(2)}`}
              />
              <MetricCard
                icon={<BarChart2 className="h-4 w-4" />}
                label="Keyword Difficulty"
                value={<KdBadge value={result.main.keyword_difficulty} />}
              />
              <MetricCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Intent"
                value={<IntentBadge intent={result.main.intent} />}
              />
            </div>

            {/* 12-month trend */}
            {result.main.monthly_searches.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">12-Month Trend</p>
                <Sparkline data={result.main.monthly_searches} height={60} />
              </div>
            )}
          </div>

          {/* Related keywords table */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold text-sm">
                Related Keywords {sortedRelated.length > 0 && `(${sortedRelated.length})`}
              </h3>
            </div>
            {sortedRelated.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                No related keywords found for this query.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <Th onClick={() => handleSort("keyword")}>
                        Keyword <SortIcon k="keyword" />
                      </Th>
                      <Th onClick={() => handleSort("search_volume")} className="text-right">
                        Volume <SortIcon k="search_volume" />
                      </Th>
                      <Th onClick={() => handleSort("cpc")} className="text-right">
                        CPC <SortIcon k="cpc" />
                      </Th>
                      <Th onClick={() => handleSort("keyword_difficulty")} className="text-center">
                        KD <SortIcon k="keyword_difficulty" />
                      </Th>
                      <Th onClick={() => handleSort("intent")}>
                        Intent <SortIcon k="intent" />
                      </Th>
                      <Th>Trend</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRelated.map((kw) => (
                      <tr key={kw.keyword} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-medium max-w-[200px] truncate">{kw.keyword}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmt(kw.search_volume)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">${kw.cpc.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <KdBadge value={kw.keyword_difficulty} />
                        </td>
                        <td className="px-4 py-2.5">
                          <IntentBadge intent={kw.intent} />
                        </td>
                        <td className="px-4 py-2.5 w-28">
                          <Sparkline data={kw.monthly_searches ?? []} height={32} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Th({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground",
        onClick && "cursor-pointer hover:text-foreground select-none",
        className
      )}
      onClick={onClick}
    >
      {children}
    </th>
  );
}
