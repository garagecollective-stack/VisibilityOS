"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuditChecksGrid } from "@/components/audit/audit-checks-grid";
import { CrawlingIndicator } from "@/components/audit/crawling-indicator";
import {
  AuditHistoryCard,
  type AuditRunSummary,
} from "@/components/audit/audit-history-card";
import { PageHeader } from "@/components/shared/page-header";
import { apiClient } from "@/lib/api";

type Project = { id: string; name: string; domain: string };

export default function AuditPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ projects: Project[] }>("/projects", {
        token: token ?? undefined,
      });
    },
    staleTime: 5 * 60 * 1000,
  });
  const projects = projectsQuery.data?.projects ?? [];

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0]!.id);
    }
  }, [projects, selectedProjectId]);

  const runsQuery = useQuery({
    queryKey: ["auditRuns", selectedProjectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ runs: AuditRunSummary[] }>(
        `/audit/runs/${selectedProjectId}`,
        { token: token ?? undefined }
      );
    },
    enabled: !!selectedProjectId,
    staleTime: 30 * 1000,
    refetchInterval: (query) => {
      const runs = (query.state.data as { runs: AuditRunSummary[] } | undefined)?.runs ?? [];
      return runs.some((r) => r.status === "pending" || r.status === "running") ? 5000 : false;
    },
  });

  const runs = runsQuery.data?.runs ?? [];
  const runningRun = runs.find((r) => r.status === "pending" || r.status === "running");
  const completedRuns = runs.filter((r) => r.status === "completed");
  const failedRuns = runs.filter((r) => r.status === "failed");
  const hasAnyRun = runs.length > 0;
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const startMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const token = await getToken();
      return apiClient<{ auditRunId: string }>("/audit/start", {
        method: "POST",
        body: JSON.stringify({ projectId }),
        token: token ?? undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["auditRuns", selectedProjectId],
      });
    },
  });

  const navigateToResults = (runId: string) => router.push(`/dashboard/audit/${runId}`);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader
        title="Site Audit"
        description="Crawl your website and surface technical SEO issues by category and severity."
      />

      {/* Project selector + start button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label className="text-sm font-medium">Project</label>
          {projectsQuery.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a project…" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{" "}
                    <span className="ml-1 text-xs text-muted-foreground">({p.domain})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button
          onClick={() => startMutation.mutate(selectedProjectId)}
          disabled={!selectedProjectId || !!runningRun || startMutation.isPending}
        >
          {startMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting…
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Start New Audit
            </>
          )}
        </Button>
      </div>

      {startMutation.isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {startMutation.error instanceof Error
            ? startMutation.error.message
            : "Failed to start audit."}
        </div>
      )}

      {/* Running audit indicator */}
      {runningRun && (
        <CrawlingIndicator
          domain={selectedProject?.domain ?? ""}
          startedAt={runningRun.startedAt}
        />
      )}

      {/* Body */}
      {!selectedProjectId ? (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-12 text-center text-sm text-muted-foreground">
            Select a project to view audit history.
          </CardContent>
        </Card>
      ) : runsQuery.isLoading ? (
        <AuditListSkeleton />
      ) : !hasAnyRun && !runningRun ? (
        // ─── Pre-audit empty state ────────────────────────────────────────
        <div className="space-y-6">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Shield className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-base font-semibold">No audits yet for this project</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Run your first audit to crawl the site and surface technical SEO issues.
              </p>
            </CardContent>
          </Card>
          <AuditChecksGrid />
        </div>
      ) : (
        // ─── History list ────────────────────────────────────────────────
        <div className="space-y-5">
          {completedRuns.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Audit History
              </p>
              <div className="space-y-2">
                {runs
                  .filter((r) => r.status !== "running" && r.status !== "pending")
                  .map((run) => (
                    <AuditHistoryCard
                      key={run.id}
                      run={run}
                      onView={navigateToResults}
                    />
                  ))}
              </div>
            </div>
          )}

          {completedRuns.length === 0 && failedRuns.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Audit in progress — results will appear here when it completes.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function AuditListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-4 p-4">
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-8 w-14" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
