"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { Bot, Globe, Plus, Sparkles, Target, TrendingUp } from "lucide-react";
import { AddPromptDialog } from "@/components/geo/add-prompt-dialog";
import { EngineCard } from "@/components/geo/engine-card";
import { PromptDetailDialog } from "@/components/geo/prompt-detail-dialog";
import { PromptsTable } from "@/components/geo/prompts-table";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import {
  ALL_PLATFORMS,
  computeGeoStats,
  EMPTY_GEO_PROMPTS,
  EMPTY_GEO_RESULTS,
  SAMPLE_GEO_PROMPTS,
  SAMPLE_GEO_RESULTS,
  type GeoPrompt,
  type GeoResult,
} from "@/lib/geo";
import type { ProjectSummary } from "@/lib/keywords";

export default function GeoTrackerPage() {
  const { getToken } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailPrompt, setDetailPrompt] = useState<GeoPrompt | null>(null);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ projects: ProjectSummary[] }>("/projects", {
        token: token ?? undefined,
      });
    },
    staleTime: 5 * 60 * 1000,
  });
  const projects = projectsQuery.data?.projects ?? [];

  const resolvedProjectId =
    selectedProjectId ?? (projects.length > 0 ? projects[0].id : null);

  const promptsQuery = useQuery({
    queryKey: ["geo-prompts", resolvedProjectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ prompts: GeoPrompt[] }>(
        `/geo/projects/${resolvedProjectId}/prompts`,
        { token: token ?? undefined }
      );
    },
    enabled: !!resolvedProjectId,
    staleTime: 60 * 1000,
  });

  const resultsQuery = useQuery({
    queryKey: ["geo-results", resolvedProjectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ results: GeoResult[] }>(
        `/geo/projects/${resolvedProjectId}/results`,
        { token: token ?? undefined }
      );
    },
    enabled: !!resolvedProjectId,
    staleTime: 60 * 1000,
  });

  const isLoading =
    projectsQuery.isLoading ||
    (!!resolvedProjectId &&
      (promptsQuery.isLoading || resultsQuery.isLoading));

  // Use module-level stable constants as fallbacks to avoid creating new array
  // references on every render, which would break useMemo([results]) below.
  const realPrompts = promptsQuery.data?.prompts ?? EMPTY_GEO_PROMPTS;
  const realResults = resultsQuery.data?.results ?? EMPTY_GEO_RESULTS;

  const isSampleData = !isLoading && realPrompts.length === 0;

  const prompts = isSampleData ? SAMPLE_GEO_PROMPTS : realPrompts;
  const results = isSampleData ? SAMPLE_GEO_RESULTS : realResults;

  const stats = useMemo(() => computeGeoStats(results), [results]);

  const showSetup = !isLoading && projects.length === 0;

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="GEO Tracker"
        description="Monitor how your brand is cited across AI-generated search results — ChatGPT, Perplexity, Gemini, and Google AI Overviews."
        action={
          <div className="flex items-center gap-2">
            {isSampleData && <SampleDataBadge />}
            {resolvedProjectId && (
              <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Prompt
              </Button>
            )}
          </div>
        }
      />

      {/* Project selector */}
      {projects.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Project:</span>
          <Select
            value={resolvedProjectId ?? ""}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="w-52 h-8 text-sm">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-sm">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}

      {/* Setup: no projects */}
      {showSetup && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.08] text-primary">
              <Globe className="h-7 w-7" />
            </div>
            <h2 className="text-base font-semibold">No projects yet</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
              Create a project first, then add GEO prompts to start tracking your AI visibility.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main content */}
      {!isLoading && !showSetup && (
        <div className="space-y-6">
          {/* Sample data notice */}
          {isSampleData && (
            <div className="flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 dark:border-purple-800 dark:bg-purple-900/20">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
              <div className="text-sm">
                <span className="font-medium text-purple-700 dark:text-purple-300">
                  Showing sample data.
                </span>{" "}
                <span className="text-purple-600 dark:text-purple-400">
                  Add your first prompt below to start tracking your real AI visibility.
                </span>
              </div>
            </div>
          )}

          {/* Metric cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Overall Citation Rate"
              value={`${stats.overallRate}%`}
              icon={<TrendingUp className="h-4 w-4" />}
              accent="green"
              hint={`${stats.citedCount}/${stats.totalChecks} checks cited`}
            />
            <MetricCard
              label="Avg Citation Position"
              value={stats.avgPosition ? `#${stats.avgPosition}` : "—"}
              icon={<Target className="h-4 w-4" />}
              accent="blue"
              hint="Among cited responses"
            />
            <MetricCard
              label="Prompts Tracked"
              value={prompts.length}
              icon={<Bot className="h-4 w-4" />}
              accent="purple"
              hint={isSampleData ? "Sample prompts" : "Active prompts"}
            />
            <MetricCard
              label="Engines Monitored"
              value={ALL_PLATFORMS.length}
              icon={<Globe className="h-4 w-4" />}
              accent="default"
              hint="ChatGPT · Perplexity · Gemini · Google AIO"
            />
          </div>

          {/* Engine breakdown */}
          <div>
            <h2 className="mb-3 text-base font-semibold">Engine Breakdown</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ALL_PLATFORMS.map((platform) => {
                const platformStats = stats.byPlatform[platform];
                return (
                  <EngineCard
                    key={platform}
                    platform={platform}
                    citedCount={platformStats.cited}
                    totalChecks={platformStats.total}
                    avgPosition={platformStats.avgPosition}
                  />
                );
              })}
            </div>
          </div>

          {/* Prompts table */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Prompts</h2>
              {!isSampleData && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddDialogOpen(true)}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Prompt
                </Button>
              )}
            </div>
            <PromptsTable
              prompts={prompts}
              results={results}
              projectId={resolvedProjectId ?? ""}
              isSample={isSampleData}
              onViewPrompt={setDetailPrompt}
            />
          </div>

        </div>
      )}

      {/* Dialogs */}
      {resolvedProjectId && (
        <AddPromptDialog
          projectId={resolvedProjectId}
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
        />
      )}

      <PromptDetailDialog
        prompt={detailPrompt}
        results={results}
        open={detailPrompt !== null}
        onOpenChange={(v) => { if (!v) setDetailPrompt(null); }}
      />
    </div>
  );
}
