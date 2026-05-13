"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface RunSummary {
  id: string;
  status: string;
  technicalScore: number | null;
  startedAt: string;
}

interface CompareData {
  run1: { id: string; date: string; score: number | null; metrics: Record<string, number> };
  run2: { id: string; date: string; score: number | null; metrics: Record<string, number> };
  diff: Record<string, { before: number; after: number; delta: number; improved: boolean }>;
}

const METRIC_LABELS: Record<string, string> = {
  pages_crawled: "Pages Crawled",
  site_health_score: "Health Score",
  total_issues: "Total Issues",
  total_errors: "Critical Errors",
  total_warnings: "Warnings",
  total_notices: "Notices",
  meta_errors: "Meta Errors",
  meta_warnings: "Meta Warnings",
  links_errors: "Link Errors",
  links_warnings: "Link Warnings",
  speed_warnings: "Speed Warnings",
  content_warnings: "Content Warnings",
  schema_notices: "Schema Notices",
  mobile_errors: "Mobile Errors",
  security_errors: "Security Errors",
  indexing_warnings: "Indexing Warnings",
  cwv_failures: "CWV Failures",
  ai_search_issues: "AI Search Issues",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface Props {
  projectId: string;
  currentRunId: string;
}

export function CompareTab({ projectId, currentRunId }: Props) {
  const { getToken } = useAuth();

  const runsQuery = useQuery({
    queryKey: ["auditRuns", projectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ runs: RunSummary[] }>(`/audit/runs/${projectId}`, {
        token: token ?? undefined,
      });
    },
  });

  const completedRuns = (runsQuery.data?.runs ?? []).filter((r) => r.status === "completed");

  const [run1Id, setRun1Id] = useState(currentRunId);
  const [run2Id, setRun2Id] = useState("");

  // Auto-select the most recent other run once the list loads.
  useEffect(() => {
    if (run2Id === "" && completedRuns.length >= 2) {
      const others = completedRuns.filter((r) => r.id !== run1Id);
      if (others[0]) setRun2Id(others[0].id);
    }
  }, [completedRuns, run1Id, run2Id]);

  const canCompare = !!run1Id && !!run2Id && run1Id !== run2Id;

  const compareQuery = useQuery<CompareData>({
    queryKey: ["auditCompare", projectId, run1Id, run2Id],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<CompareData>(
        `/audit/compare/${projectId}?run1=${encodeURIComponent(run1Id)}&run2=${encodeURIComponent(run2Id)}`,
        { token: token ?? undefined }
      );
    },
    enabled: canCompare,
  });

  if (runsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (completedRuns.length < 2) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          You need at least 2 completed audits to compare. Run another audit to unlock this feature.
        </CardContent>
      </Card>
    );
  }

  const runOptions = completedRuns.map((r) => ({
    id: r.id,
    label: `${formatDate(r.startedAt)} — Score ${r.technicalScore ?? "?"}`,
  }));

  const data = compareQuery.data;
  const fixed = data ? Object.values(data.diff).filter((d) => d.improved && d.delta !== 0).length : 0;
  const regressed = data ? Object.values(data.diff).filter((d) => !d.improved && d.delta !== 0).length : 0;

  return (
    <div className="space-y-5">
      {/* Run selectors */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Run 1 (Previous)
          </label>
          <Select value={run1Id} onValueChange={setRun1Id}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select a run…" />
            </SelectTrigger>
            <SelectContent>
              {runOptions.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Run 2 (Current)
          </label>
          <Select value={run2Id} onValueChange={setRun2Id}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select a run…" />
            </SelectTrigger>
            <SelectContent>
              {runOptions.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!canCompare && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Select two different runs to compare.
        </p>
      )}

      {compareQuery.isLoading && canCompare && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {data && canCompare && (
        <>
          {/* Summary */}
          <div className="flex flex-wrap gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <span className="font-medium">
              Comparing:{" "}
              <span className="text-muted-foreground">{formatDate(data.run1.date)}</span>
              {" → "}
              <span className="text-muted-foreground">{formatDate(data.run2.date)}</span>
            </span>
            {fixed > 0 && (
              <span className="text-green-600 font-semibold">
                {fixed} metric{fixed !== 1 ? "s" : ""} improved
              </span>
            )}
            {regressed > 0 && (
              <span className="text-red-600 font-semibold">
                {regressed} metric{regressed !== 1 ? "s" : ""} regressed
              </span>
            )}
          </div>

          {/* Comparison table */}
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-left">Metric</th>
                  <th className="px-4 py-2 text-right">Previous</th>
                  <th className="px-4 py-2 text-right">Current</th>
                  <th className="px-4 py-2 text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Object.entries(data.diff).map(([key, val]) => (
                  <tr key={key} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">
                      {METRIC_LABELS[key] ?? key}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {val.before}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                      {val.after}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <DeltaBadge delta={val.delta} improved={val.improved} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function DeltaBadge({ delta, improved }: { delta: number; improved: boolean }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        improved
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      )}
    >
      {delta > 0 ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      {delta > 0 ? "+" : ""}
      {delta}
    </span>
  );
}
