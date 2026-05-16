"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BarChart2,
  DollarSign,
  MousePointerClick,
  Search,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CompetitionBadge } from "@/components/keywords/competition-badge";
import { IntentBadge } from "@/components/keywords/intent-badge";
import { KdBadge } from "@/components/keywords/kd-badge";
import { KeywordClustersPanel } from "@/components/keywords/keyword-clusters-panel";
import { KeywordVariationsTable } from "@/components/keywords/keyword-variations-table";
import { PeopleAlsoAsk, type PaaQuestion } from "@/components/keywords/people-also-ask";
import { SerpFeaturesGrid } from "@/components/keywords/serp-features-grid";
import { SerpTop10, type OrganicResult } from "@/components/keywords/serp-top10";
import { DeviceToggle, type Device } from "@/components/shared/device-toggle";
import { LocationFilter, type LocationSelection } from "@/components/LocationFilter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import {
  formatMetric,
  KEYWORD_LOCATIONS,
  type KeywordOverviewResult,
} from "@/lib/keywords";
import { ssGet, ssParse, ssSet, ssStringify } from "@/lib/session-store";

interface SerpResponse {
  organic: OrganicResult[];
  paa: PaaQuestion[];
  serp_features: string[];
}

interface SerpInput {
  keyword: string;
  locationCode: number;
  device: Device;
}

export default function KeywordOverviewPage() {
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [locationCode, setLocationCode] = useState<number>(2356);
  const [device, setDevice] = useState<Device>("desktop");

  const [results, setResults] = useState<KeywordOverviewResult | null>(null);
  const [resultsFor, setResultsFor] = useState("");
  const [serpInput, setSerpInput] = useState<SerpInput | null>(null);
  const [showSlowMessage, setShowSlowMessage] = useState(false);

  useEffect(() => {
    const kw = ssGet("lastOverviewKeyword");
    const data = ssParse<KeywordOverviewResult>("lastOverviewResult");
    const storedLocation = ssGet("lastOverviewLocation");
    const storedDevice = ssGet("lastOverviewDevice");
    const usedLocation = storedLocation ?? "2356";
    const usedDevice: Device =
      storedDevice === "desktop" || storedDevice === "mobile" ? storedDevice : "desktop";
    setLocationCode(Number(usedLocation));
    setDevice(usedDevice);
    if (kw && data) {
      setQuery(kw);
      setResults(data);
      setResultsFor(kw);
      setSerpInput({ keyword: kw, locationCode: Number(usedLocation), device: usedDevice });
    }
  }, []);

  const overviewMutation = useMutation({
    mutationFn: async (keyword: string) => {
      const token = await getToken();
      return apiClient<KeywordOverviewResult>("/keywords/overview", {
        method: "POST",
        body: JSON.stringify({
          keyword,
          locationCode,
          languageCode: "en",
          device,
        }),
        token: token ?? undefined,
      });
    },
    onSuccess: (data, keyword) => {
      setResults(data);
      setResultsFor(keyword);
      ssSet("lastOverviewKeyword", keyword);
      ssSet("lastOverviewLocation", String(locationCode));
      ssSet("lastOverviewDevice", device);
      ssStringify("lastOverviewResult", data);
    },
  });

  const serpQuery = useQuery({
    queryKey: [
      "serp",
      serpInput?.keyword,
      serpInput?.locationCode,
      serpInput?.device,
    ],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<SerpResponse>("/keywords/serp", {
        method: "POST",
        body: JSON.stringify(serpInput),
        token: token ?? undefined,
      });
    },
    enabled: !!serpInput,
    staleTime: 6 * 60 * 60 * 1000, // 6h, matches Redis TTL
    retry: 1,
  });

  // Slow-loading hint: if SERP query takes > 10s show a subtle message
  useEffect(() => {
    if (!serpQuery.isLoading) {
      setShowSlowMessage(false);
      return;
    }
    const timer = setTimeout(() => setShowSlowMessage(true), 10_000);
    return () => clearTimeout(timer);
  }, [serpQuery.isLoading, serpInput]);

  const sortedMonths = useMemo(() => {
    if (!results) return [];
    return [...results.main.monthly_searches].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    );
  }, [results]);

  const averageVolume = useMemo(() => {
    if (sortedMonths.length === 0) return null;
    const total = sortedMonths.reduce((sum, m) => sum + m.search_volume, 0);
    return Math.round(total / sortedMonths.length);
  }, [sortedMonths]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    const kw = query.trim();
    setResults(null);
    overviewMutation.mutate(kw);
    setSerpInput({ keyword: kw, locationCode, device });
  };

  const showEmpty = results === null && !overviewMutation.isPending;
  const showSkeleton = overviewMutation.isPending;
  const showResults = results !== null && !overviewMutation.isPending;

  const selectedLocation = KEYWORD_LOCATIONS.find((l) => l.value === String(locationCode));

  // Auto-refetch overview + SERP when the user picks a new location via LocationFilter.
  // The ref is flipped only inside the user-driven handler so initial mount and session
  // restore (which also set `locationCode`) do not trigger an unwanted re-fetch.
  const userPickedLocationRef = useRef(false);
  const handleLocationChange = (loc: LocationSelection) => {
    userPickedLocationRef.current = true;
    setLocationCode(loc.location_code);
  };
  useEffect(() => {
    if (!userPickedLocationRef.current) return;
    if (!resultsFor) return;
    setSerpInput({ keyword: resultsFor, locationCode, device });
    overviewMutation.mutate(resultsFor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationCode]);

  // SERP data — fall back to empty so child components can decide whether to render
  const serpData = serpQuery.data ?? null;
  const serpFeatures =
    serpData?.serp_features?.length
      ? serpData.serp_features
      : results?.main.serp_item_types ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Keyword Overview</h2>
        <p className="text-sm text-muted-foreground">
          Inspect demand, intent, and adjacent opportunities around a target keyword.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
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
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DeviceToggle value={device} onChange={setDevice} />
          <div className="ml-auto text-xs text-muted-foreground">
            Language: <span className="font-medium text-foreground">English</span>
          </div>
        </div>
        <LocationFilter
          onLocationChange={handleLocationChange}
          defaultCountryCode={2356}
        />
      </form>

      {overviewMutation.isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {overviewMutation.error instanceof Error
            ? overviewMutation.error.message
            : "Failed to analyze keyword."}
        </div>
      )}

      {showEmpty && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <h3 className="font-medium">Start with a keyword</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Run an overview to inspect volume, CPC, difficulty, intent, competition, and related keyword demand.
            </p>
          </CardContent>
        </Card>
      )}

      {showSkeleton && <OverviewSkeleton />}

      {showResults && results && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Showing results for:</span>
            <span className="font-medium text-foreground">{resultsFor}</span>
            <span>·</span>
            <span>{selectedLocation?.flag} {selectedLocation?.label}</span>
            <span>·</span>
            <span className="capitalize">{device}</span>
          </div>

          {/* 6 metric cards — Volume / CPC / KD / Intent / Competition / Traffic Potential */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Search Volume"
              value={formatMetric(results.main.search_volume)}
            />
            <MetricCard
              icon={<DollarSign className="h-4 w-4" />}
              label="CPC"
              value={`$${results.main.cpc.toFixed(2)}`}
            />
            <MetricCard
              icon={<BarChart2 className="h-4 w-4" />}
              label="Keyword Difficulty"
              value={<KdBadge value={results.main.keyword_difficulty} />}
            />
            <MetricCard
              icon={<Search className="h-4 w-4" />}
              label="Intent"
              value={<IntentBadge intent={results.main.intent} />}
            />
            <MetricCard
              icon={<Target className="h-4 w-4" />}
              label="Competition"
              value={
                <CompetitionBadge
                  value={results.main.competition}
                  level={results.main.competition_level}
                />
              }
            />
            <MetricCard
              icon={<MousePointerClick className="h-4 w-4" />}
              label="Traffic Potential"
              value={`${formatMetric(Math.round(results.main.search_volume * 0.28))} /mo`}
            />
          </div>

          {/* 12-month trend */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{results.main.keyword}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">12-month search trend</p>
                </div>
                <div className="flex items-center gap-2">
                  <IntentBadge intent={results.main.intent} />
                  <CompetitionBadge
                    value={results.main.competition}
                    level={results.main.competition_level}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sortedMonths.length > 0 ? (
                <div className="h-72 rounded-lg border bg-background p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sortedMonths}>
                      <XAxis
                        dataKey="month"
                        tickFormatter={(_month, index) => {
                          const point = sortedMonths[index];
                          if (!point) return "";
                          return new Date(point.year, point.month - 1).toLocaleString("default", {
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
                        cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "3 3" }}
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 6,
                          fontSize: 12,
                        }}
                        formatter={(value: number) => [value.toLocaleString(), "Volume"]}
                        labelFormatter={(_, payload) => {
                          const point = payload?.[0]?.payload as
                            | { year: number; month: number }
                            | undefined;
                          if (!point) return "";
                          return new Date(point.year, point.month - 1).toLocaleString("default", {
                            month: "long",
                            year: "numeric",
                          });
                        }}
                      />
                      {averageVolume !== null && (
                        <ReferenceLine
                          y={averageVolume}
                          stroke="hsl(var(--muted-foreground))"
                          strokeDasharray="4 4"
                          label={{
                            value: `Avg ${formatMetric(averageVolume)}`,
                            position: "insideTopRight",
                            fontSize: 10,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="search_volume"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4 }}
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

          {/* Step 4 — SERP Features (uses main response data, renders immediately) */}
          <SerpFeaturesGrid serpItemTypes={serpFeatures} />

          {/* Step 5 — Keyword Variations (replaces old related-keywords table) */}
          <KeywordVariationsTable keywords={results.related} />

          {/* Step 5B — Keyword Topic Clusters */}
          {results.related.length > 0 && (
            <KeywordClustersPanel keywords={results.related} />
          )}

          {/* Slow SERP hint */}
          {serpQuery.isLoading && showSlowMessage && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-400">
              Loading SERP data… (this may take up to 60s on first request — results are cached for 6h)
            </div>
          )}

          {serpQuery.isError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              SERP data unavailable: {serpQuery.error instanceof Error ? serpQuery.error.message : "Unknown error"}
            </div>
          )}

          {/* Step 6 — People Also Ask (SERP-backed, hides when empty post-load) */}
          <PeopleAlsoAsk
            questions={serpData?.paa ?? []}
            loading={serpQuery.isLoading}
          />

          {/* Step 7 — Top Ranking Pages (SERP-backed, hides when empty post-load) */}
          <SerpTop10
            results={serpData?.organic ?? []}
            loading={serpQuery.isLoading}
          />
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

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
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
