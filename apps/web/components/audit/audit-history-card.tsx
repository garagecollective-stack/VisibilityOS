"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileSearch,
  Loader2,
  Timer,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AuditRunSummary {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  pagesCrawled: number;
  totalIssues: number;
  criticalIssues: number;
  warnings: number;
  notices: number;
  technicalScore: number | null;
  cwvScore: number | null;
  failureReason: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface Props {
  run: AuditRunSummary;
  onView: (runId: string) => void;
}

export function AuditHistoryCard({ run, onView }: Props) {
  const isCompleted = run.status === "completed";
  const isFailed = run.status === "failed";
  const score = run.technicalScore;

  return (
    <Card
      className={cn(
        "transition-colors",
        isCompleted && "cursor-pointer hover:bg-muted/40"
      )}
      onClick={isCompleted ? () => onView(run.id) : undefined}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-4">
          <RunStatusIcon status={run.status} score={score} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {new Date(run.startedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <RunStatusBadge status={run.status} />
              {isCompleted && run.criticalIssues > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  <XCircle className="h-3 w-3" />
                  {run.criticalIssues} critical
                </span>
              )}
            </div>
            {isCompleted && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <FileSearch className="h-3 w-3" />
                  {run.pagesCrawled.toLocaleString()} pages
                </span>
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {run.totalIssues.toLocaleString()} issues
                </span>
                {run.completedAt && (
                  <span className="inline-flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {formatDuration(run.startedAt, run.completedAt)}
                  </span>
                )}
              </div>
            )}
            {isFailed && (
              <p className="text-xs text-destructive">
                {run.failureReason ?? "Audit failed. Ensure the crawler service is running."}
              </p>
            )}
          </div>
          {isCompleted && score !== null && <ScorePill score={score} />}
        </div>

        {isCompleted && (
          <div className="flex justify-end border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onView(run.id);
              }}
            >
              View Results
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RunStatusIcon({
  status,
  score,
}: {
  status: AuditRunSummary["status"];
  score: number | null;
}) {
  if (status === "completed") {
    const color =
      score === null
        ? "text-muted-foreground"
        : score >= 90
        ? "text-green-500"
        : score >= 70
        ? "text-blue-500"
        : score >= 50
        ? "text-yellow-500"
        : "text-red-500";
    return <CheckCircle2 className={cn("mt-0.5 h-5 w-5 shrink-0", color)} />;
  }
  if (status === "failed")
    return <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />;
  if (status === "running")
    return <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />;
  return <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />;
}

function RunStatusBadge({ status }: { status: AuditRunSummary["status"] }) {
  const cls: Record<AuditRunSummary["status"], string> = {
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    running: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    pending: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  const labels: Record<AuditRunSummary["status"], string> = {
    completed: "Completed",
    failed: "Failed",
    running: "Running",
    pending: "Pending",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cls[status])}>
      {labels[status]}
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 90
      ? "text-green-600"
      : score >= 70
      ? "text-blue-600"
      : score >= 50
      ? "text-yellow-600"
      : "text-red-600";
  const label =
    score >= 90 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Needs Work" : "Critical";
  return (
    <div className="shrink-0 text-right">
      <div className={cn("text-2xl font-bold tabular-nums", color)}>{score}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}
