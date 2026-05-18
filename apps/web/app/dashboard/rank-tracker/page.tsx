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
  Clock,
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
import { MetricCard } from "@/components/shared/metric-card";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { PageHeader } from "@/components/shared/page-header";
import { apiClient } from "@/lib/api";
import { KEYWORD_LOCATIONS } from "@/lib/keywords";
import { ssGet, ssSet } from "@/lib/session-store";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Project = {
  id: string;
  name: string;
  domain: string;
  countryCode: string;
};

type TrackedWithPosition = {
  id: string;
  keyword: string;
  locationCode: string;
  languageCode: string;
  device: string;
  currentPosition: number | null;
  previousPosition: number | null;
  change: number | null;
  bestPosition: number | null;
  url: string | null;
  serpFeatures: string[];
  lastCheckedAt: string | null;
  hasData: boolean;
};

type VisibilityPoint = { date: string; visibility_score: number; estimated_traffic: number };

const DAY_OPTIONS = [7, 30, 60, 90] as const;
type DayOption = (typeof DAY_OPTIONS)[number];

type PositionBucket = "all" | "top3" | "top10" | "top100" | "not_ranking";
type ChangeBucket = "all" | "improved" | "declined" | "no_change";
type DeviceFilter = "all" | "desktop" | "mobile";

const PAGE_SIZE = 25;

const SERP_FEATURE_ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  featured_snippet: { icon: Star, label: "Featured Snippet" },
  people_also_ask: { icon: HelpCircle, label: "People Also Ask" },
  video: { icon: Play, label: "Video Pack" },
  images: { icon: ImageIcon, label: "Image Pack" },
  local_pack: { icon: MapPin, label: "Local Pack" },
  sitelinks: { icon: LinkIcon, label: "Sitelinks" },
  ai_overview: { icon: Sparkles, label: "AI Overview" },
};

const SAMPLE_COMPETITORS = [
  "wikipedia.org", "moz.com", "ahrefs.com", "semrush.com", "backlinko.com",
  "neilpatel.com", "searchenginejournal.com", "wordstream.com", "hubspot.com", "yoast.com",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockVisibilitySeries(days: number): VisibilityPoint[] {
  const out: VisibilityPoint[] = [];
  let base = 38;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    base += (Math.sin(i / 6) + (Math.random() - 0.45)) * 1.6;
    base = Math.max(15, Math.min(90, base));
    out.push({
      date: d.toISOString().split("T")[0]!,
      visibility_score: Math.round(base * 10) / 10,
      estimated_traffic: Math.round(120 + base * 22),
    });
  }
  return out;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.length > 1 ? u.pathname : u.hostname;
  } catch {
    return url;
  }
}

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
  const [detailKeyword, setDetailKeyword] = useState<TrackedWithPosition | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ projects: Project[] }>("/projects", { token: token ?? undefined });
    },
    staleTime: 5 * 60 * 1000,
  });

  const projects = projectsQuery.data?.projects ?? [];

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

  useEffect(() => { setPage(1); }, [search, posBucket, changeBucket, deviceFilter]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const twpQuery = useQuery({
    queryKey: ["tracked-with-positions", selectedProjectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ keywords: TrackedWithPosition[] }>(
        `/rank/projects/${selectedProjectId}/tracked-with-positions`,
        { token: token ?? undefined }
      );
    },
    enabled: !!selectedProjectId,
    retry: false,
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
  });

  const tracked = twpQuery.data?.keywords ?? [];
  const hasAnyData = tracked.some((k) => k.hasData);

  const lastCheckedAt = useMemo(
    () =>
      tracked.reduce<string | null>((latest, kw) => {
        if (!kw.lastCheckedAt) return latest;
        if (!latest) return kw.lastCheckedAt;
        return kw.lastCheckedAt > latest ? kw.lastCheckedAt : latest;
      }, null),
    [tracked]
  );

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

  const top3Count = tracked.filter((r) => r.currentPosition !== null && r.currentPosition <= 3).length;
  const top10Count = tracked.filter((r) => r.currentPosition !== null && r.currentPosition <= 10).length;
  const top100Count = tracked.filter((r) => r.currentPosition !== null && r.currentPosition <= 100).length;
  const avgPos = (() => {
    const withData = tracked.filter((r) => r.currentPosition !== null);
    if (!withData.length) return null;
    return Math.round((withData.reduce((s, r) => s + r.currentPosition!, 0) / withData.length) * 10) / 10;
  })();

  const filteredRows = useMemo(() => {
    return tracked.filter((r) => {
      if (search && !r.keyword.toLowerCase().includes(search.toLowerCase())) return false;
      if (posBucket === "top3" && (r.currentPosition === null || r.currentPosition > 3)) return false;
      if (posBucket === "top10" && (r.currentPosition === null || r.currentPosition > 10)) return false;
      if (posBucket === "top100" && (r.currentPosition === null || r.currentPosition > 100)) return false;
      if (posBucket === "not_ranking" && r.currentPosition !== null && r.currentPosition <= 100) return false;
      if (changeBucket === "improved" && (r.change === null || r.change <= 0)) return false;
      if (changeBucket === "declined" && (r.change === null || r.change >= 0)) return false;
      if (changeBucket === "no_change" && r.change !== 0) return false;
      if (deviceFilter !== "all" && r.device !== deviceFilter) return false;
      return true;
    });
  }, [tracked, search, posBucket, changeBucket, deviceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: async (keywordId: string) => {
      const token = await getToken();
      return apiClient(
        `/keywords/projects/${selectedProjectId}/tracked/${keywordId}`,
        { method: "DELETE", token: token ?? undefined }
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tracked-with-positions", selectedProjectId] });
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

  const isLoading = projectsQuery.isLoading || (!!selectedProjectId && twpQuery.isLoading);

  const invalidateTracked = async () => {
    await queryClient.invalidateQueries({ queryKey: ["tracked-with-positions", selectedProjectId] });
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Rank Tracker"
        description="Daily Google rankings for your tracked keywords, with visibility trend and SERP context."
        action={
          <div className="flex items-center gap-2">
            {projects.length > 0 && (
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="min-w-[220px]">
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
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddDialogOpen(true)}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Keywords
                </Button>
                <Button
                variant="outline"
                size="sm"
                onClick={() => checkNowMutation.mutate()}
                disabled={checkNowMutation.isPending}
              >
                <RotateCw className={cn("mr-1.5 h-3.5 w-3.5", checkNowMutation.isPending && "animate-spin")} />
                {checkNowMutation.isPending ? "Queuing…" : "Check Now"}
              </Button>
              </>
            )}
          </div>
        }
      />

      {/* Daily check indicator */}
      {tracked.length > 0 && (
        <div className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {lastCheckedAt
            ? `Last checked: ${timeAgo(lastCheckedAt)} · Checks run daily`
            : "No checks run yet · Checks run daily at ~3:00 AM UTC"}
        </div>
      )}

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
      {!isLoading && selectedProject && tracked.length === 0 && !twpQuery.isLoading && (
        <SetupForm project={selectedProject} onAdded={invalidateTracked} />
      )}

      {/* Main dashboard */}
      {!isLoading && selectedProject && tracked.length > 0 && (
        <>
          {/* No ranking data yet banner */}
          {!hasAnyData && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-400">
              <strong>No ranking data yet.</strong> Rank checks run daily. Click{" "}
              <button
                type="button"
                onClick={() => checkNowMutation.mutate()}
                disabled={checkNowMutation.isPending}
                className="underline underline-offset-2 font-medium disabled:opacity-50"
              >
                {checkNowMutation.isPending ? "Queuing…" : "Check Now"}
              </button>{" "}
              to trigger an immediate check.
            </div>
          )}

          {/* Top metrics */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <MetricCard
              label="Visibility Score"
              value={hasAnyData ? latestVisibility.toFixed(1) : "—"}
              icon={<Eye className="h-4 w-4" />}
              accent="purple"
              sampleData={usingMockVisibility && hasAnyData}
              tooltip="0–100 estimate of your share of organic search traffic across tracked keywords."
            />
            <MetricCard
              label="Top 3"
              value={hasAnyData ? top3Count : "—"}
              icon={<Star className="h-4 w-4" />}
              accent="green"
            />
            <MetricCard
              label="Top 10"
              value={hasAnyData ? top10Count : "—"}
              icon={<TrendingUp className="h-4 w-4" />}
              accent="blue"
            />
            <MetricCard
              label="Top 100"
              value={hasAnyData ? top100Count : "—"}
              icon={<Target className="h-4 w-4" />}
            />
            <MetricCard
              label="Avg Position"
              value={hasAnyData && avgPos !== null ? avgPos : "—"}
              icon={<TrendingUp className="h-4 w-4" />}
              hint={hasAnyData ? "Lower is better" : undefined}
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
                  {filteredRows.length !== tracked.length && ` / ${tracked.length}`}
                </span>
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
                      <TableHead>URL</TableHead>
                      <TableHead>SERP</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                          No keywords match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedRows.map((row) => (
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
                            {row.bestPosition !== null ? `#${row.bestPosition}` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.currentPosition !== null ? (
                              <PositionPill position={row.currentPosition} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.change !== null ? (
                              <ChangeIndicator change={row.change} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[160px]">
                            {row.url ? (
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
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <SerpFeatureIcons features={row.serpFeatures} />
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
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Add Keywords Dialog */}
      {selectedProject && (
        <AddKeywordsDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          project={selectedProject}
          onAdded={invalidateTracked}
        />
      )}

      {/* Detail slide-out */}
      {detailKeyword && (
        <KeywordDetailDrawer
          keyword={detailKeyword}
          projectId={selectedProjectId}
          onClose={() => setDetailKeyword(null)}
        />
      )}
    </div>
  );
}

// ── Keyword form shared state ─────────────────────────────────────────────────

function useKeywordForm(project: Project) {
  const projectLocationValue =
    KEYWORD_LOCATIONS.find((l) => l.code === project.countryCode)?.value ?? "2356";
  const [raw, setRaw] = useState("");
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
  return { raw, setRaw, location, setLocation, device, setDevice, keywords };
}

// ── Setup form ────────────────────────────────────────────────────────────────

function SetupForm({
  project,
  onAdded,
}: {
  project: Project;
  onAdded: () => Promise<void>;
}) {
  const { getToken } = useAuth();
  const form = useKeywordForm(project);

  const addMutation = useMutation({
    mutationFn: () => submitKeywords(getToken, project.id, form.keywords, form.location, form.device),
    onSuccess: async () => {
      form.setRaw("");
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
        <KeywordFormFields form={form} />
        {addMutation.isError && (
          <p className="text-sm text-destructive">
            {addMutation.error instanceof Error ? addMutation.error.message : "Failed to add keywords."}
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
            disabled={form.keywords.length === 0 || addMutation.isPending}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {addMutation.isPending ? "Starting…" : "Start Tracking"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Add Keywords Dialog ───────────────────────────────────────────────────────

function AddKeywordsDialog({
  open,
  onOpenChange,
  project,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onAdded: () => Promise<void>;
}) {
  const { getToken } = useAuth();
  const form = useKeywordForm(project);

  const addMutation = useMutation({
    mutationFn: () => submitKeywords(getToken, project.id, form.keywords, form.location, form.device),
    onSuccess: async () => {
      form.setRaw("");
      await onAdded();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Keywords to Track</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <KeywordFormFields form={form} />
          {addMutation.isError && (
            <p className="text-sm text-destructive">
              {addMutation.error instanceof Error ? addMutation.error.message : "Failed to add keywords."}
            </p>
          )}
          {addMutation.isSuccess && (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
              Added {addMutation.data.added} keywords · {addMutation.data.duplicates} duplicates skipped
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={form.keywords.length === 0 || addMutation.isPending}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {addMutation.isPending ? "Adding…" : "Add Keywords"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Shared form fields ────────────────────────────────────────────────────────

type KeywordFormState = ReturnType<typeof useKeywordForm>;

function KeywordFormFields({ form }: { form: KeywordFormState }) {
  return (
    <>
      <Textarea
        placeholder="One keyword per line (up to 100)"
        className="min-h-36"
        value={form.raw}
        onChange={(e) => form.setRaw(e.target.value)}
      />
      <p className="text-sm text-muted-foreground">{form.keywords.length}/100 keywords ready</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Location</Label>
          <CountrySelector value={form.location} onValueChange={form.setLocation} className="w-full" />
        </div>
        <div className="space-y-2">
          <Label>Device</Label>
          <Select value={form.device} onValueChange={(v) => form.setDevice(v as typeof form.device)}>
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
    </>
  );
}

async function submitKeywords(
  getToken: () => Promise<string | null>,
  projectId: string,
  keywords: string[],
  location: string,
  device: "desktop" | "mobile" | "both"
): Promise<{ added: number; duplicates: number }> {
  const token = await getToken();
  const devices: Array<"desktop" | "mobile"> = device === "both" ? ["desktop", "mobile"] : [device];
  const results = await Promise.all(
    devices.map((dev) =>
      apiClient<{ added: number; duplicates: number }>(
        `/keywords/projects/${projectId}/tracked`,
        {
          method: "POST",
          body: JSON.stringify({ keywords, locationCode: Number(location), languageCode: "en", device: dev }),
          token: token ?? undefined,
        }
      )
    )
  );
  return results.reduce(
    (acc, r) => ({ added: acc.added + r.added, duplicates: acc.duplicates + r.duplicates }),
    { added: 0, duplicates: 0 }
  );
}

// ── Detail drawer ─────────────────────────────────────────────────────────────

function KeywordDetailDrawer({
  keyword,
  projectId,
  onClose,
}: {
  keyword: TrackedWithPosition;
  projectId: string;
  onClose: () => void;
}) {
  const { getToken } = useAuth();
  const historyQuery = useQuery({
    queryKey: ["rank-history-detail", keyword.id],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{
        history: Array<{ checked_at: string; position: number }>;
      }>(`/rank/projects/${projectId}/history?keywordId=${keyword.id}&days=90`, {
        token: token ?? undefined,
      });
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const series =
    historyQuery.data?.history?.map((h) => ({
      date: new Date(h.checked_at).toISOString().split("T")[0]!,
      position: h.position,
    })) ?? [];

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{keyword.keyword}</p>
            <p className="text-xs text-muted-foreground">
              {keyword.locationCode} · <span className="capitalize">{keyword.device}</span>
              {keyword.currentPosition !== null && (
                <span className="ml-2 font-medium text-foreground">· #{keyword.currentPosition} current</span>
              )}
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
            <h3 className="mb-2 text-sm font-semibold">Position History (90d)</h3>
            {historyQuery.isLoading ? (
              <Skeleton className="h-56 w-full rounded-md" />
            ) : series.length > 0 ? (
              <>
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
              </>
            ) : (
              <div className="flex h-56 items-center justify-center rounded-md border border-dashed bg-muted/30 text-center text-sm text-muted-foreground">
                <div>
                  <p className="font-medium">No history yet</p>
                  <p className="mt-1 text-xs">Position data will appear after the first rank check.</p>
                </div>
              </div>
            )}
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
        <Minus className="h-3 w-3" />0
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
