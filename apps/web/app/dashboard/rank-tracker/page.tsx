"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  Eye,
  HelpCircle,
  Image as ImageIcon,
  Link as LinkIcon,
  MapPin,
  Minus,
  Play,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { CountrySelector } from "@/components/shared/country-selector";
import { DeviceToggle, type Device } from "@/components/shared/device-toggle";
import { MetricCard } from "@/components/shared/metric-card";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import { formatMetric, KEYWORD_LOCATIONS } from "@/lib/keywords";
import { ssGet, ssSet } from "@/lib/session-store";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  domain: string;
  countryCode: string;
};

type TrackedKeyword = {
  id: string;
  projectId: string;
  keyword: string;
  locationCode: string;
  languageCode: string;
  device: string;
  isActive: boolean;
  createdAt: string;
};

type RankAggregate = {
  keyword_id: string;
  keyword: string;
  current_position: number;
  best_position: number;
  worst_position: number;
  data_points: number;
  last_checked: string;
};

type VisibilityPoint = { date: string; visibility_score: number; estimated_traffic: number };

const DAY_OPTIONS = [7, 30, 60, 90] as const;
type DayOption = (typeof DAY_OPTIONS)[number];

type PositionBucket = "all" | "top3" | "top10" | "top100" | "not_ranking";
type ChangeBucket = "all" | "improved" | "declined" | "no_change";
type DeviceFilter = "all" | "desktop" | "mobile";

const SERP_FEATURE_ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  featured_snippet: { icon: Star, label: "Featured Snippet" },
  people_also_ask: { icon: HelpCircle, label: "People Also Ask" },
  video: { icon: Play, label: "Video Pack" },
  images: { icon: ImageIcon, label: "Image Pack" },
  local_pack: { icon: MapPin, label: "Local Pack" },
  sitelinks: { icon: LinkIcon, label: "Sitelinks" },
  ai_overview: { icon: Sparkles, label: "AI Overview" },
};

// ── Mock helpers ─────────────────────────────────────────────────────────────

function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mockRowForKeyword(keyword: string): {
  current_position: number;
  previous_position: number;
  best_position: number;
  volume: number;
  cpc: number;
  url: string;
  serp_features: string[];
} {
  const seed = seedFromString(keyword);
  const currentPosition = (seed % 80) + 1;
  const delta = (seed % 21) - 10;
  const previousPosition = Math.max(1, Math.min(100, currentPosition + delta));
  const bestPosition = Math.max(1, currentPosition - (seed % 8));
  const volume = 200 + (seed % 18_000);
  const cpc = Math.round((0.5 + ((seed % 500) / 100)) * 100) / 100;
  const url = `https://example.com/${keyword.replace(/\s+/g, "-").toLowerCase()}`;
  const features: string[] = [];
  if (seed % 3 === 0) features.push("featured_snippet");
  if (seed % 5 === 0) features.push("people_also_ask");
  if (seed % 7 === 0) features.push("sitelinks");
  if (seed % 11 === 0) features.push("ai_overview");
  return {
    current_position: currentPosition,
    previous_position: previousPosition,
    best_position: bestPosition,
    volume,
    cpc,
    url,
    serp_features: features,
  };
}

function mockVisibilitySeries(days: number): VisibilityPoint[] {
  const out: VisibilityPoint[] = [];
  let base = 38;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    base += (Math.sin(i / 6) + (Math.random() - 0.45)) * 1.6;
    base = Math.max(15, Math.min(90, base));
    out.push({
      date: d.toISOString().split("T")[0],
      visibility_score: Math.round(base * 10) / 10,
      estimated_traffic: Math.round(120 + base * 22),
    });
  }
  return out;
}

function mockKeywordHistory(keyword: string, days: number): Array<{ date: string; position: number }> {
  const out: Array<{ date: string; position: number }> = [];
  const seed = seedFromString(keyword);
  let pos = mockRowForKeyword(keyword).current_position;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    pos += ((seed + i * 7) % 11) - 5;
    pos = Math.max(1, Math.min(100, pos));
    out.push({ date: d.toISOString().split("T")[0], position: pos });
  }
  return out;
}

const SAMPLE_COMPETITORS = [
  "wikipedia.org",
  "moz.com",
  "ahrefs.com",
  "semrush.com",
  "backlinko.com",
  "neilpatel.com",
  "searchenginejournal.com",
  "wordstream.com",
  "hubspot.com",
  "yoast.com",
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RankTrackerPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [days, setDays] = useState<DayOption>(30);
  const [search, setSearch] = useState("");
  const [posBucket, setPosBucket] = useState<PositionBucket>("all");
  const [changeBucket, setChangeBucket] = useState<ChangeBucket>("all");
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>("all");
  const [detailKeyword, setDetailKeyword] = useState<TrackedKeyword | null>(null);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ projects: Project[] }>("/projects", { token: token ?? undefined });
    },
  });

  const projects = projectsQuery.data?.projects ?? [];

  // Restore from localStorage exactly once after projects load. Keeping
  // `selectedProjectId` in deps fought the save effect and looped infinitely
  // whenever the user picked a different project.
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current || projects.length === 0) return;
    initializedRef.current = true;
    const saved = ssGet("rankTrackerProject");
    if (saved && projects.some((p) => p.id === saved)) setSelectedProjectId(saved);
    else setSelectedProjectId(projects[0]!.id);
  }, [projects]);

  useEffect(() => {
    if (selectedProjectId) ssSet("rankTrackerProject", selectedProjectId);
  }, [selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const trackedQuery = useQuery({
    queryKey: ["trackedKeywords", selectedProjectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ keywords: TrackedKeyword[] }>(
        `/keywords/projects/${selectedProjectId}/tracked`,
        { token: token ?? undefined }
      );
    },
    enabled: !!selectedProjectId,
  });

  const visibilityQuery = useQuery({
    queryKey: ["visibility-rt", selectedProjectId, days],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ visibility: VisibilityPoint[] }>(
        `/rank/projects/${selectedProjectId}/visibility`,
        { token: token ?? undefined }
      );
    },
    enabled: !!selectedProjectId,
    retry: false,
  });

  const historyQuery = useQuery({
    queryKey: ["rank-history-rt", selectedProjectId, days],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ history: RankAggregate[] }>(
        `/rank/projects/${selectedProjectId}/history?days=${days}`,
        { token: token ?? undefined }
      );
    },
    enabled: !!selectedProjectId,
    retry: false,
  });

  const tracked = trackedQuery.data?.keywords ?? [];
  const realHistory = historyQuery.data?.history ?? [];
  const historyByKeywordId = useMemo(
    () => new Map(realHistory.map((h) => [h.keyword_id, h])),
    [realHistory]
  );

  // Merge tracked with rank data (real where available, mock otherwise)
  const rows = useMemo(() => {
    return tracked.map((kw) => {
      const real = historyByKeywordId.get(kw.id);
      const mock = mockRowForKeyword(kw.keyword);
      const currentPosition = real?.current_position ?? mock.current_position;
      const bestPosition = real?.best_position ?? mock.best_position;
      const previousPosition = mock.previous_position;
      const change = previousPosition - currentPosition;
      return {
        ...kw,
        current_position: currentPosition,
        best_position: bestPosition,
        change,
        volume: mock.volume,
        cpc: mock.cpc,
        url: mock.url,
        serp_features: mock.serp_features,
        is_real: !!real,
      };
    });
  }, [tracked, historyByKeywordId]);

  const usingMockHistory = realHistory.length === 0 && tracked.length > 0;
  const realVisibility = visibilityQuery.data?.visibility ?? [];
  const visibility = useMemo(
    () =>
      realVisibility.length > 0
        ? [...realVisibility].reverse().slice(-days)
        : mockVisibilitySeries(days),
    [realVisibility, days]
  );
  const usingMockVisibility = realVisibility.length === 0;

  const latestVisibility = visibility.length > 0 ? visibility[visibility.length - 1]!.visibility_score : 0;
  const top3Count = rows.filter((r) => r.current_position <= 3).length;
  const top10Count = rows.filter((r) => r.current_position <= 10).length;
  const top100Count = rows.filter((r) => r.current_position <= 100).length;
  const avgPos = rows.length
    ? Math.round((rows.reduce((s, r) => s + r.current_position, 0) / rows.length) * 10) / 10
    : 0;

  // Filtered rows for table
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (search && !r.keyword.toLowerCase().includes(search.toLowerCase())) return false;
      if (posBucket === "top3" && r.current_position > 3) return false;
      if (posBucket === "top10" && r.current_position > 10) return false;
      if (posBucket === "top100" && r.current_position > 100) return false;
      if (posBucket === "not_ranking" && r.current_position <= 100) return false;
      if (changeBucket === "improved" && r.change <= 0) return false;
      if (changeBucket === "declined" && r.change >= 0) return false;
      if (changeBucket === "no_change" && r.change !== 0) return false;
      if (deviceFilter !== "all" && r.device !== deviceFilter) return false;
      return true;
    });
  }, [rows, search, posBucket, changeBucket, deviceFilter]);

  const deleteMutation = useMutation({
    mutationFn: async (keywordId: string) => {
      const token = await getToken();
      return apiClient(
        `/keywords/projects/${selectedProjectId}/tracked/${keywordId}`,
        { method: "DELETE", token: token ?? undefined }
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trackedKeywords", selectedProjectId] });
    },
  });

  const checkNowMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return apiClient<{ queued: number }>(
        `/rank/projects/${selectedProjectId}/check-now`,
        { method: "POST", body: JSON.stringify({}), token: token ?? undefined }
      );
    },
  });

  const isLoading = projectsQuery.isLoading || (!!selectedProjectId && trackedQuery.isLoading);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rank Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Daily Google rankings for your tracked keywords, with visibility trend and SERP context.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {projects.length > 0 && (
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="min-w-[260px]">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    <span className="ml-1.5 text-xs text-muted-foreground">{p.domain}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedProjectId && tracked.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkNowMutation.mutate()}
              disabled={checkNowMutation.isPending}
            >
              <RotateCw className={cn("mr-1.5 h-3.5 w-3.5", checkNowMutation.isPending && "animate-spin")} />
              {checkNowMutation.isPending ? "Queuing…" : "Check Now"}
            </Button>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      )}

      {/* No project */}
      {!isLoading && projects.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Create a project from the dashboard to start tracking keywords.
          </CardContent>
        </Card>
      )}

      {/* Setup state — no tracked keywords yet */}
      {!isLoading && selectedProject && tracked.length === 0 && (
        <SetupForm
          project={selectedProject}
          onAdded={async () => {
            await queryClient.invalidateQueries({
              queryKey: ["trackedKeywords", selectedProjectId],
            });
          }}
        />
      )}

      {/* Main dashboard */}
      {!isLoading && selectedProject && tracked.length > 0 && (
        <>
          {/* Top metrics */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <MetricCard
              label="Visibility Score"
              value={latestVisibility.toFixed(1)}
              icon={<Eye className="h-4 w-4" />}
              accent="purple"
              sampleData={usingMockVisibility}
              tooltip="0–100 estimate of your share of organic search traffic across tracked keywords."
            />
            <MetricCard
              label="Top 3"
              value={top3Count}
              icon={<Star className="h-4 w-4" />}
              accent="green"
              sampleData={usingMockHistory}
            />
            <MetricCard
              label="Top 10"
              value={top10Count}
              icon={<TrendingUp className="h-4 w-4" />}
              accent="blue"
              sampleData={usingMockHistory}
            />
            <MetricCard
              label="Top 100"
              value={top100Count}
              icon={<Target className="h-4 w-4" />}
              sampleData={usingMockHistory}
            />
            <MetricCard
              label="Avg Position"
              value={avgPos || "—"}
              icon={<TrendingUp className="h-4 w-4" />}
              hint="Lower is better"
              sampleData={usingMockHistory}
            />
          </div>

          {/* Visibility chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Visibility Trend</CardTitle>
                {usingMockVisibility && <SampleDataBadge />}
              </div>
              <div className="inline-flex items-center rounded-md border bg-background p-0.5">
                {DAY_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={cn(
                      "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                      days === d
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={visibility} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rtVisibilityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) =>
                        new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                      }
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={36}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                      labelFormatter={(v) =>
                        new Date(String(v)).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      }
                      formatter={(v: number) => [v, "Visibility"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="visibility_score"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#rtVisibilityGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Filters + Keywords table */}
          <Card>
            <CardHeader className="space-y-3 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Tracked Keywords</CardTitle>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {filteredRows.length}
                  {filteredRows.length !== rows.length && ` / ${rows.length}`}
                </span>
                {usingMockHistory && <SampleDataBadge />}
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_140px_140px_120px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-9 pl-9"
                    placeholder="Filter keywords…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={posBucket} onValueChange={(v) => setPosBucket(v as PositionBucket)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All positions</SelectItem>
                    <SelectItem value="top3">Top 3</SelectItem>
                    <SelectItem value="top10">Top 10</SelectItem>
                    <SelectItem value="top100">Top 100</SelectItem>
                    <SelectItem value="not_ranking">Not ranking</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={changeBucket} onValueChange={(v) => setChangeBucket(v as ChangeBucket)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Change" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All changes</SelectItem>
                    <SelectItem value="improved">Improved</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                    <SelectItem value="no_change">No change</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={deviceFilter} onValueChange={(v) => setDeviceFilter(v as DeviceFilter)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Device" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All devices</SelectItem>
                    <SelectItem value="desktop">Desktop</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Keyword</TableHead>
                      <TableHead className="text-right">Best</TableHead>
                      <TableHead className="text-right">Current</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">CPC</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>SERP</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                          No keywords match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer"
                          onClick={() => setDetailKeyword(row)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{row.keyword}</span>
                              <span className="rounded-md border bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                {row.device}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                            #{row.best_position}
                          </TableCell>
                          <TableCell className="text-right">
                            <PositionPill position={row.current_position} />
                          </TableCell>
                          <TableCell className="text-right">
                            <ChangeIndicator change={row.change} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMetric(row.volume)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            ${row.cpc.toFixed(2)}
                          </TableCell>
                          <TableCell className="max-w-[160px]">
                            <a
                              href={row.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 truncate text-xs text-primary hover:underline"
                            >
                              <span className="truncate">{prettyUrl(row.url)}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          </TableCell>
                          <TableCell>
                            <SerpFeatureIcons features={row.serp_features} />
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              title="Remove from tracking"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Remove "${row.keyword}" from rank tracking?`)) {
                                  deleteMutation.mutate(row.id);
                                }
                              }}
                              className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Detail slide-out */}
      {detailKeyword && (
        <KeywordDetailDrawer
          keyword={detailKeyword}
          onClose={() => setDetailKeyword(null)}
        />
      )}
    </div>
  );
}

// ── Setup form ───────────────────────────────────────────────────────────────

function SetupForm({
  project,
  onAdded,
}: {
  project: Project;
  onAdded: () => Promise<void>;
}) {
  const { getToken } = useAuth();
  const [raw, setRaw] = useState("");
  const projectLocationValue =
    KEYWORD_LOCATIONS.find((l) => l.code === project.countryCode)?.value ?? "2356";
  const [location, setLocation] = useState<string>(projectLocationValue);
  const [device, setDevice] = useState<"desktop" | "mobile" | "both">("desktop");

  const keywords = useMemo(
    () =>
      raw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 100),
    [raw]
  );

  const addMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const devices: Array<"desktop" | "mobile"> = device === "both" ? ["desktop", "mobile"] : [device];
      const results = await Promise.all(
        devices.map((dev) =>
          apiClient<{ added: number; duplicates: number }>(
            `/keywords/projects/${project.id}/tracked`,
            {
              method: "POST",
              body: JSON.stringify({
                keywords,
                locationCode: Number(location),
                languageCode: "en",
                device: dev,
              }),
              token: token ?? undefined,
            }
          )
        )
      );
      return results.reduce(
        (acc, r) => ({ added: acc.added + r.added, duplicates: acc.duplicates + r.duplicates }),
        { added: 0, duplicates: 0 }
      );
    },
    onSuccess: async () => {
      setRaw("");
      await onAdded();
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Add keywords to track</CardTitle>
        <p className="text-sm text-muted-foreground">
          Paste up to 100 keywords. We'll check Google rankings daily for {project.domain}.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="One keyword per line"
          className="min-h-44"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          {keywords.length}/100 keywords ready
        </p>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
          <div className="space-y-2">
            <Label>Location</Label>
            <CountrySelector value={location} onValueChange={setLocation} className="w-full" />
          </div>
          <div className="space-y-2">
            <Label>Device</Label>
            <Select value={device} onValueChange={(v) => setDevice(v as typeof device)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desktop">Desktop</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
                <SelectItem value="both">Both (Desktop + Mobile)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {addMutation.isError && (
          <p className="text-sm text-destructive">
            {addMutation.error instanceof Error
              ? addMutation.error.message
              : "Failed to add keywords."}
          </p>
        )}

        {addMutation.isSuccess && (
          <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-400">
            Tracking started · {addMutation.data.added} added · {addMutation.data.duplicates} duplicates skipped
          </p>
        )}

        <div className="flex justify-end">
          <Button
            onClick={() => addMutation.mutate()}
            disabled={keywords.length === 0 || addMutation.isPending}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {addMutation.isPending ? "Starting…" : "Start Tracking"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Detail drawer ────────────────────────────────────────────────────────────

function KeywordDetailDrawer({
  keyword,
  onClose,
}: {
  keyword: TrackedKeyword;
  onClose: () => void;
}) {
  const { getToken } = useAuth();
  const historyQuery = useQuery({
    queryKey: ["rank-history-detail", keyword.id],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{
        history: Array<{ checked_at: string; position: number }>;
      }>(`/rank/projects/${keyword.projectId}/history?keywordId=${keyword.id}&days=90`, {
        token: token ?? undefined,
      });
    },
    retry: false,
  });

  const realHistory =
    historyQuery.data?.history?.map((h) => ({
      date: new Date(h.checked_at).toISOString().split("T")[0],
      position: h.position,
    })) ?? [];
  const series = realHistory.length > 0 ? realHistory : mockKeywordHistory(keyword.keyword, 90);
  const usingMock = realHistory.length === 0;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{keyword.keyword}</p>
            <p className="text-xs text-muted-foreground">
              {keyword.locationCode} · <span className="capitalize">{keyword.device}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Position History (90d)</h3>
              {usingMock && <SampleDataBadge />}
            </div>
            <div className="h-56 rounded-md border bg-muted/10 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) =>
                      new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                    }
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={28}
                  />
                  <YAxis
                    reversed
                    domain={[1, 100]}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                    formatter={(v: number) => [`#${v}`, "Position"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="position"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Y-axis is reversed — lower is better.</p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">SERP Screenshot</h3>
            <div className="flex h-32 items-center justify-center rounded-md border border-dashed bg-muted/30 text-xs text-muted-foreground">
              SERP screenshots coming soon
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold">Top 10 Competitors</h3>
              <SampleDataBadge />
            </div>
            <ul className="space-y-1.5">
              {SAMPLE_COMPETITORS.map((domain, i) => (
                <li
                  key={domain}
                  className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold tabular-nums">
                    {i + 1}
                  </span>
                  <img
                    src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`}
                    alt=""
                    width={14}
                    height={14}
                    className="h-3.5 w-3.5 shrink-0 rounded-sm"
                  />
                  <span className="flex-1 font-medium">{domain}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PositionPill({ position }: { position: number }) {
  const cls =
    position <= 3
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : position <= 10
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      : position <= 100
      ? "bg-muted text-muted-foreground"
      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", cls)}>
      #{position}
    </span>
  );
}

function ChangeIndicator({ change }: { change: number }) {
  if (change === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
        <Minus className="h-3 w-3" />
        0
      </span>
    );
  }
  const positive = change > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
        positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
      )}
    >
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {positive ? "+" : ""}
      {change}
    </span>
  );
}

function SerpFeatureIcons({ features }: { features: string[] }) {
  if (features.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1">
      {features.map((code) => {
        const cfg = SERP_FEATURE_ICONS[code];
        if (!cfg) return null;
        const Icon = cfg.icon;
        return (
          <span
            key={code}
            title={cfg.label}
            className="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-muted-foreground"
          >
            <Icon className="h-3 w-3" />
          </span>
        );
      })}
    </div>
  );
}

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.length > 1 ? u.pathname : "/";
  } catch {
    return url;
  }
}
