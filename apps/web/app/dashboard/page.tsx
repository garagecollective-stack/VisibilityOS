"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  FolderOpen,
  Plus,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
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
import { MetricCard } from "@/components/shared/metric-card";
import { DashboardProjectSelector } from "@/components/dashboard/project-selector";
import { RankMovementsChart } from "@/components/dashboard/rank-movements-chart";
import { TopMoversTable } from "@/components/dashboard/top-movers-table";
import { RecentAlerts } from "@/components/dashboard/recent-alerts";
import { ProjectHealthCard } from "@/components/dashboard/project-health-card";
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";
import { GscConnectionCard } from "@/components/dashboard/gsc-connection-card";
import { IssuesSummary } from "@/components/dashboard/issues-summary";
import { CompetitorSnapshot } from "@/components/dashboard/competitor-snapshot";
import { apiClient } from "@/lib/api";
import { ssGet, ssSet } from "@/lib/session-store";

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

export default function DashboardPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [countryCode, setCountryCode] = useState("IN");
  const [domainError, setDomainError] = useState("");

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ projects: Project[] }>("/projects", { token: token ?? undefined });
    },
  });

  const projects = projectsQuery.data?.projects ?? [];

  // Restore selected project from localStorage exactly once after projects load.
  // Keeping `selectedProjectId` in deps caused this to fight effect#2 below
  // and reverted user clicks back to the stored value — infinite re-render.
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

  const trackedCount = trackedKeywordsQuery.data?.keywords.length ?? 0;
  const latestVisibility = visibilityQuery.data?.visibility?.[0]?.visibility_score ?? null;

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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your SEO performance across keywords, audits, and competitors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && projects.length > 0 && (
            <DashboardProjectSelector
              projects={projects}
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            />
          )}
          {!isLoading && projects.length > 0 && (
            <Button onClick={openDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Project
            </Button>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && projects.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">No projects yet</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Create your first project to start tracking keywords, running audits, and measuring SEO performance.
            </p>
            <Button className="mt-6" onClick={openDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Project
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main */}
      {!isLoading && selectedProject && (
        <>
          {/* Top stats row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Overall Health Score"
              icon={<ShieldCheck className="h-4 w-4" />}
              value={latestCompletedAudit?.technicalScore ?? "—"}
              hint={
                latestCompletedAudit?.technicalScore != null
                  ? scoreHint(latestCompletedAudit.technicalScore)
                  : "Run an audit"
              }
              accent={accentForScore(latestCompletedAudit?.technicalScore ?? null)}
              tooltip="Composite SEO health score (0–100) based on your most recent site audit."
            />
            <MetricCard
              label="Tracked Keywords"
              icon={<Target className="h-4 w-4" />}
              value={trackedCount}
              trend={trackedCount > 0 ? { value: 12 } : null}
              hint="vs last week"
              accent="blue"
              sampleData={trackedCount > 0}
              tooltip="Total number of keywords being tracked across this project."
            />
            <MetricCard
              label="Average Position"
              icon={<TrendingUp className="h-4 w-4" />}
              value={trackedCount > 0 ? "14.8" : "—"}
              trend={trackedCount > 0 ? { value: -1.2 } : null}
              hint={trackedCount > 0 ? "Lower is better" : "No data yet"}
              accent="default"
              sampleData={trackedCount > 0}
              tooltip="Mean Google search position across all tracked keywords."
            />
            <MetricCard
              label="Visibility Score"
              icon={<Eye className="h-4 w-4" />}
              value={latestVisibility != null ? latestVisibility.toFixed(1) : "—"}
              trend={latestVisibility != null ? { value: 2.4 } : null}
              hint="Organic share of voice"
              accent="purple"
              sampleData={latestVisibility == null}
              tooltip="A 0–100 estimate of your share of organic search traffic for tracked keywords."
            />
          </div>

          {/* Main grid 60/40 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="space-y-4 lg:col-span-3">
              <RankMovementsChart projectId={selectedProjectId} />
              <TopMoversTable projectId={selectedProjectId} />
              <RecentAlerts />
            </div>
            <div className="space-y-4 lg:col-span-2">
              <ProjectHealthCard
                domain={selectedProject.domain}
                countryCode={selectedProject.countryCode}
                technicalScore={latestCompletedAudit?.technicalScore ?? null}
                keywordsScore={null}
                backlinksScore={null}
              />
              <QuickActionsCard />
              <GscConnectionCard connected={!!selectedProject.gscConnected} />
            </div>
          </div>

          {/* Bottom row */}
          <IssuesSummary
            hasAudit={!!latestCompletedAudit}
            criticalIssues={latestCompletedAudit?.criticalIssues ?? 0}
            warnings={latestCompletedAudit?.warnings ?? 0}
            notices={latestCompletedAudit?.notices ?? 0}
            pagesCrawled={latestCompletedAudit?.pagesCrawled ?? 0}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CompetitorSnapshot competitors={selectedProject.settings?.competitors ?? []} />
            <Card className="border-dashed">
              <CardContent className="flex h-full flex-col items-center justify-center py-10 text-center">
                <Search className="mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="font-medium">Keyword Opportunities</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Discover new keywords you don't yet track from Search Console and SERP analysis.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <a href="/dashboard/keywords/ideas">Explore Ideas</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Add Project dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
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
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={!canSubmit}>
              {createMutation.isPending ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function scoreHint(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs work";
  return "Critical";
}

function accentForScore(score: number | null): "green" | "yellow" | "red" | "blue" | "default" {
  if (score === null) return "default";
  if (score >= 90) return "green";
  if (score >= 70) return "blue";
  if (score >= 50) return "yellow";
  return "red";
}
