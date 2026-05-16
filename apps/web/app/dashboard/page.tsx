"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FolderOpen, Globe, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { DashboardProjectSelector } from "@/components/dashboard/project-selector";
import { DomainAnalyticsWidget } from "@/components/dashboard/domain-analytics-widget";
import { PositionTrackingWidget } from "@/components/dashboard/position-tracking-widget";
import { SiteAuditWidget } from "@/components/dashboard/site-audit-widget";
import {
  AlertsWidget,
  IssuesOverviewWidget,
  QuickActionsWidget,
  QuickStatsWidget,
} from "@/components/dashboard/dashboard-sidebar";
import { PageSpeedWidget } from "@/components/dashboard/pagespeed-widget";
import { apiClient } from "@/lib/api";
import { ssGet, ssSet } from "@/lib/session-store";

// ── Constants ─────────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: "IN", label: "India" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
  { code: "CA", label: "Canada" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "SG", label: "Singapore" },
  { code: "PK", label: "Pakistan" },
  { code: "BD", label: "Bangladesh" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "NL", label: "Netherlands" },
  { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" },
  { code: "JP", label: "Japan" },
  { code: "ZA", label: "South Africa" },
  { code: "NG", label: "Nigeria" },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  domain: string;
  countryCode: string;
  createdAt: string;
  gscConnected?: boolean;
  settings?: { competitors?: string[] };
}

interface AuditRun {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  technicalScore: number | null;
  pagesCrawled: number;
  criticalIssues: number;
  warnings: number;
  notices: number;
  completedAt: string | null;
}

interface TrackedKeyword {
  id: string;
  keyword: string;
}

interface VisibilityPoint {
  date: string;
  visibility_score: number;
}

interface DashboardData {
  backlinks: {
    referringDomains: number | null;
    referringDomainsDelta: number | null;
    totalBacklinks: number | null;
    domainAuthority: number | null;
    lastCheckedAt: string | null;
  };
  contentScore: number | null;
  pagesWithIssues: number;
  pagesCrawled: number;
  keywordDistribution: Record<string, number>;
  keywordChanges: { newKeywords: number; lostKeywords: number };
  topPages: Array<{ url: string; position: number; kwCount: number }>;
  pagespeed: {
    mobile: number | null;
    desktop: number | null;
    lcp_ms: number | null;
    cls: number | null;
    last_checked: string;
  } | null;
}

// ── Sample visibility points (when no real data) ──────────────────────────────

function generateSamplePoints(): VisibilityPoint[] {
  const out: VisibilityPoint[] = [];
  let base = 42;
  for (let i = 29; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    base += (Math.random() - 0.35) * 4;
    base = Math.max(15, Math.min(90, base));
    out.push({
      date: day.toISOString().split("T")[0]!,
      visibility_score: Math.round(base * 10) / 10,
    });
  }
  return out;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [countryCode, setCountryCode] = useState("IN");
  const [domainError, setDomainError] = useState("");

  // ── Data fetching (unchanged) ───────────────────────────────────────────────

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ projects: Project[] }>("/projects", { token: token ?? undefined });
    },
  });

  const projects = projectsQuery.data?.projects ?? [];

  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current || projects.length === 0) return;
    initializedRef.current = true;
    const saved = ssGet("dashboardSelectedProject");
    if (saved && projects.some((p) => p.id === saved)) {
      setSelectedProjectId(saved);
    } else {
      setSelectedProjectId(projects[0]!.id);
    }
  }, [projects]);

  useEffect(() => {
    if (selectedProjectId) ssSet("dashboardSelectedProject", selectedProjectId);
  }, [selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const auditRunsQuery = useQuery({
    queryKey: ["auditRuns", selectedProjectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ runs: AuditRun[] }>(`/audit/runs/${selectedProjectId}`, {
        token: token ?? undefined,
      });
    },
    enabled: !!selectedProjectId,
  });

  const latestCompletedAudit =
    auditRunsQuery.data?.runs.find((run) => run.status === "completed") ?? null;

  const trackedKeywordsQuery = useQuery({
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
    queryKey: ["visibility-dashboard", selectedProjectId],
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

  const dashboardQuery = useQuery({
    queryKey: ["dashboardData", selectedProjectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<DashboardData>(`/dashboard/${selectedProjectId}`, {
        token: token ?? undefined,
      });
    },
    enabled: !!selectedProjectId,
    retry: false,
  });

  const trackedCount = trackedKeywordsQuery.data?.keywords.length ?? 0;
  const latestVisibility = visibilityQuery.data?.visibility?.[0]?.visibility_score ?? null;
  const dashData = dashboardQuery.data;

  // ── Derived values ──────────────────────────────────────────────────────────

  const visibilityPoints = useMemo(() => {
    const real = visibilityQuery.data?.visibility ?? [];
    return real.length > 0 ? [...real].reverse() : generateSamplePoints();
  }, [visibilityQuery.data]);

  const isSampleVisibility = (visibilityQuery.data?.visibility ?? []).length === 0;
  const isSampleDomain = dashData?.backlinks.domainAuthority == null;

  // ── Mutations ───────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return apiClient<{ project: Project }>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          domain: domain.trim().toLowerCase(),
          countryCode,
        }),
        token: token ?? undefined,
      });
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setSelectedProjectId(data.project.id);
      closeDialog();
    },
  });

  const openDialog = () => {
    setName("");
    setDomain("");
    setCountryCode("IN");
    setDomainError("");
    createMutation.reset();
    setDialogOpen(true);
  };

  const closeDialog = () => setDialogOpen(false);

  const validateDomain = (value: string) => {
    const raw = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const valid = /^[a-zA-Z0-9][a-zA-Z0-9\-_.]+\.[a-zA-Z]{2,}$/.test(raw);
    setDomainError(valid || raw === "" ? "" : "Enter a valid domain, e.g. example.com");
    return raw;
  };

  const handleDomainChange = (value: string) => {
    const cleaned = value.replace(/^https?:\/\//, "").replace(/\/$/, "");
    setDomain(cleaned);
    if (cleaned) validateDomain(cleaned);
    else setDomainError("");
  };

  const canSubmit =
    name.trim().length > 0 && domain.trim().length > 0 && !domainError && !createMutation.isPending;

  const isLoading = projectsQuery.isLoading;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F8F9FA" }}>
      {/* ── Project header bar ── */}
      <div
        className="flex items-center justify-between gap-4 bg-white px-6 py-3"
        style={{ borderBottom: "1px solid #F0F0F5" }}
      >
        {/* Left — project selector + domain */}
        <div className="flex items-center gap-4 min-w-0">
          {isLoading ? (
            <Skeleton className="h-9 w-64" />
          ) : projects.length > 0 ? (
            <DashboardProjectSelector
              projects={projects}
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            />
          ) : null}

          {selectedProject && (
            <a
              href={`https://${selectedProject.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-sm hover:underline truncate"
              style={{ color: "#6B7280" }}
            >
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{selectedProject.domain}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          )}
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2 shrink-0">
          {projects.length > 0 && (
            <Button size="sm" onClick={openDialog}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Project
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild>
            <a href="/dashboard/settings" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="p-6 space-y-4">
        {/* Loading skeletons */}
        {isLoading && (
          <div className="grid grid-cols-10 gap-4">
            <div className="col-span-7 space-y-4">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-80 w-full rounded-lg" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
            <div className="col-span-3 space-y-4">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-56 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && projects.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <FolderOpen className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">No projects yet</h2>
              <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                Create your first project to start tracking keywords, running audits, and measuring SEO performance.
              </p>
              <Button className="mt-6" onClick={openDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Project
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Main 70/30 layout ── */}
        {!isLoading && selectedProject && (
          <div className="grid grid-cols-10 gap-4 items-start">
            {/* LEFT — 7 cols (70%) */}
            <div className="col-span-10 lg:col-span-7 space-y-4">
              {/* Widget 1 — Domain Analytics */}
              <DomainAnalyticsWidget
                domainAuthority={dashData?.backlinks.domainAuthority ?? null}
                referringDomains={dashData?.backlinks.referringDomains ?? null}
                referringDomainsDelta={dashData?.backlinks.referringDomainsDelta ?? null}
                totalBacklinks={dashData?.backlinks.totalBacklinks ?? null}
                trackedKeywords={trackedCount}
                isSample={isSampleDomain}
              />

              {/* Widget 2 — Position Tracking */}
              <PositionTrackingWidget
                visibility={visibilityPoints}
                keywordDistribution={dashData?.keywordDistribution ?? {}}
                latestVisibility={latestVisibility}
                isSample={isSampleVisibility}
              />

              {/* Widget 3 — Site Audit */}
              <SiteAuditWidget
                latestRun={latestCompletedAudit}
                pagesWithIssues={dashData?.pagesWithIssues ?? 0}
              />
            </div>

            {/* RIGHT — 3 cols (30%), sticky */}
            <div className="col-span-10 lg:col-span-3 space-y-4 lg:sticky lg:top-4">
              <QuickStatsWidget
                domainAuthority={dashData?.backlinks.domainAuthority ?? null}
                referringDomains={dashData?.backlinks.referringDomains ?? null}
                totalBacklinks={dashData?.backlinks.totalBacklinks ?? null}
                trackedKeywords={trackedCount}
              />
              <AlertsWidget />
              <IssuesOverviewWidget
                criticalIssues={latestCompletedAudit?.criticalIssues ?? 0}
                warnings={latestCompletedAudit?.warnings ?? 0}
                notices={latestCompletedAudit?.notices ?? 0}
                hasAudit={!!latestCompletedAudit}
                latestRunId={latestCompletedAudit?.id}
              />
              <PageSpeedWidget
                pagespeed={dashData?.pagespeed ?? null}
                auditHref={latestCompletedAudit ? `/dashboard/audit/${latestCompletedAudit.id}` : "/dashboard/audit"}
              />
              <QuickActionsWidget />
            </div>
          </div>
        )}
      </div>

      {/* ── Add Project dialog (unchanged) ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                placeholder="My Website"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-domain">Domain</Label>
              <Input
                id="project-domain"
                placeholder="example.com"
                value={domain}
                onChange={(e) => handleDomainChange(e.target.value)}
                onBlur={() => domain && validateDomain(domain)}
              />
              {domainError && <p className="text-xs text-destructive">{domainError}</p>}
              <p className="text-xs text-muted-foreground">Without https:// or trailing slash</p>
            </div>

            <div className="space-y-2">
              <Label>Primary country</Label>
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {createMutation.isError && (
            <p className="text-sm text-destructive">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Failed to create project."}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!canSubmit}>
              {createMutation.isPending ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
