"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "@tanstack/react-query";
import {
  BarChart2,
  DollarSign,
  Search,
  TrendingUp,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IntentBadge } from "@/components/keywords/intent-badge";
import { KdBadge } from "@/components/keywords/kd-badge";
import { Sparkline } from "@/components/keywords/sparkline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/lib/api";
import { formatMetric, type KeywordOverviewResult, type KeywordRow } from "@/lib/keywords";
import { cn } from "@/lib/utils";

type SortKey = keyof Omit<KeywordRow, "monthly_searches">;
type SortDir = "asc" | "desc";

export default function KeywordOverviewPage() {
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("search_volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const overviewMutation = useMutation({
    mutationFn: async (keyword: string) => {
      const token = await getToken();
      return apiClient<KeywordOverviewResult>("/keywords/overview", {
        method: "POST",
        body: JSON.stringify({ keyword, locationCode: 2356, languageCode: "en" }),
        token: token ?? undefined,
      });
    },
  });

  const result = overviewMutation.data;
  const sortedRelated = result
    ? [...result.related].sort((a, b) => {
        const av = a[sortKey] ?? -1;
        const bv = b[sortKey] ?? -1;
        const cmp = typeof av === "string" ? av.localeCompare(String(bv)) : Number(av) - Number(bv);
        return sortDir === "asc" ? cmp : -cmp;
      })
    : [];

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    overviewMutation.mutate(query.trim());
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  };

  const SortMarker = ({ field }: { field: SortKey }) => {
    if (sortKey !== field) return <span className="ml-1 opacity-30">+/-</span>;
    return <span className="ml-1">{sortDir === "asc" ? "^" : "v"}</span>;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Keyword Overview</h2>
        <p className="text-sm text-muted-foreground">
          Inspect demand, intent, and adjacent opportunities around a target keyword.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Enter a keyword to analyze"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={!query.trim() || overviewMutation.isPending}>
          {overviewMutation.isPending ? "Analyzing..." : "Analyze"}
        </Button>
      </form>

      {overviewMutation.isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {overviewMutation.error instanceof Error
            ? overviewMutation.error.message
            : "Failed to analyze keyword."}
        </div>
      )}

      {!result && !overviewMutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <h3 className="font-medium">Start with a keyword</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Run an overview to inspect volume, CPC, difficulty, intent, and related keyword demand.
            </p>
          </CardContent>
        </Card>
      )}

      {overviewMutation.isPending && <OverviewSkeleton />}

      {result && !overviewMutation.isPending && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Search Volume"
              value={formatMetric(result.main.search_volume)}
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
              icon={<Search className="h-4 w-4" />}
              label="Intent"
              value={<IntentBadge intent={result.main.intent} />}
            />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{result.main.keyword}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <IntentBadge intent={result.main.intent} />
                <span className="text-sm text-muted-foreground">
                  Primary opportunity snapshot with 12-month search demand.
                </span>
              </div>

              {result.main.monthly_searches.length > 0 ? (
                <div className="h-72 rounded-lg border bg-background p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.main.monthly_searches}>
                      <XAxis
                        dataKey="month"
                        tickFormatter={(month, index) => {
                          const point = result.main.monthly_searches[index];
                          return new Date(point.year, month - 1).toLocaleString("default", {
                            month: "short",
                          });
                        }}
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(value) => formatMetric(value)}
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value: number) => [value.toLocaleString(), "Volume"]}
                        labelFormatter={(_, payload) => {
                          const point = payload?.[0]?.payload as { year: number; month: number } | undefined;
                          if (!point) return "";
                          return new Date(point.year, point.month - 1).toLocaleString("default", {
                            month: "short",
                            year: "numeric",
                          });
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="search_volume"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No 12-month trend data is available for this keyword yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Related Keywords</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedRelated.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No related keywords were returned for this query.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <SortableHead onClick={() => handleSort("keyword")}>
                          Keyword <SortMarker field="keyword" />
                        </SortableHead>
                        <SortableHead className="text-right" onClick={() => handleSort("search_volume")}>
                          Volume <SortMarker field="search_volume" />
                        </SortableHead>
                        <SortableHead className="text-right" onClick={() => handleSort("cpc")}>
                          CPC <SortMarker field="cpc" />
                        </SortableHead>
                        <SortableHead className="text-center" onClick={() => handleSort("keyword_difficulty")}>
                          KD <SortMarker field="keyword_difficulty" />
                        </SortableHead>
                        <SortableHead onClick={() => handleSort("intent")}>
                          Intent <SortMarker field="intent" />
                        </SortableHead>
                        <TableHead className="min-w-32">Trend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedRelated.map((keyword) => (
                        <TableRow key={keyword.keyword}>
                          <TableCell className="max-w-64 font-medium">{keyword.keyword}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMetric(keyword.search_volume)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            ${keyword.cpc.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            <KdBadge value={keyword.keyword_difficulty} />
                          </TableCell>
                          <TableCell>
                            <IntentBadge intent={keyword.intent} />
                          </TableCell>
                          <TableCell className="min-w-32">
                            <Sparkline data={keyword.monthly_searches} height={34} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
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
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className="text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function SortableHead({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-foreground", className)}
      onClick={onClick}
    >
      {children}
    </TableHead>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 p-6">
          <Skeleton className="h-6 w-40" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
