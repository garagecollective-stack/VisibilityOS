"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  FileSearch,
  Info,
  Loader2,
  Play,
  Printer,
  Timer,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/shared/metric-card";
import { ScoreBreakdown } from "@/components/audit/score-breakdown";
import { IssuesList, type IssueRow } from "@/components/audit/issues-list";
import {
  CrawledPagesTable,
  type CrawledPage,
} from "@/components/audit/crawled-pages-table";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

type AuditRun = {
  id: string;
  projectId: string;
  status: "pending" | "running" | "completed" | "failed";
  pagesCrawled: number;
  totalIssues: number;
  criticalIssues: number;
  warnings: number;
  notices: number;
  technicalScore: number | null;
  cwvScore: number | null;
  crawledPages: CrawledPage[];
  failureReason: string | null;
  startedAt: string;
  completedAt: string | null;
  project: { id: string; name: string; domain: string };
};

type ResultsData = { run: AuditRun; issues: IssueRow[] };

export default function AuditResultsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams();
  const auditRunId = params.auditRunId as string;

  const resultsQuery = useQuery({
    queryKey: ["auditResults", auditRunId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<ResultsData>(`/audit/results/${auditRunId}`, {
        token: token ?? undefined,
      });
    },
  });

  const rerunMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const token = await getToken();
      return apiClient<{ auditRunId: string }>("/audit/start", {
        method: "POST",
        body: JSON.stringify({ projectId }),
        token: token ?? undefined,
      });
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["auditRuns"] });
      router.push(`/dashboard/audit/${data.auditRunId}`);
    },
  });

  if (resultsQuery.isLoading) return <ResultsSkeleton />;

  if (resultsQuery.error || !resultsQuery.data) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <BackButton />
        <Card className="mt-4 border-destructive/40">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <p className="font-medium">Failed to load audit results.</p>
            <p className="text-sm text-muted-foreground">
              {resultsQuery.error instanceof Error
                ? resultsQuery.error.message
                : "Unknown error."}
            </p>
            <Button variant="outline" onClick={() => resultsQuery.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { run, issues } = resultsQuery.data;
  const score = run.technicalScore ?? 0;
  const duration = run.completedAt ? formatDuration(run.startedAt, run.completedAt) : "—";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 print:max-w-none print:p-0">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <BackButton />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Export PDF
          </Button>
          <Button
            size="sm"
            onClick={() => rerunMutation.mutate(run.project.id)}
            disabled={rerunMutation.isPending}
          >
            {rerunMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Starting…
              </>
            ) : (
              <>
                <Play className="mr-1.5 h-3.5 w-3.5" />
                Re-run Audit
              </>
            )}
          </Button>
        </div>
      </div>

      {rerunMutation.isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive print:hidden">
          {rerunMutation.error instanceof Error
            ? rerunMutation.error.message
            : "Failed to start a new audit."}
        </div>
      )}

      {/* Health score + summary cards */}
      <div className="grid gap-6 md:grid-cols-[180px_1fr]">
        <div className="flex flex-col items-center gap-2">
          <HealthScoreCircle score={score} />
          <ScoreBandLabel score={score} />
          <p className="text-xs text-muted-foreground">Overall Score</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            label="Total Issues"
            value={run.totalIssues}
            icon={<AlertTriangle className="h-4 w-4" />}
            accent="default"
          />
          <MetricCard
            label="Critical"
            value={run.criticalIssues}
            icon={<XCircle className="h-4 w-4" />}
            accent="red"
          />
          <MetricCard
            label="Warnings"
            value={run.warnings}
            icon={<AlertTriangle className="h-4 w-4" />}
            accent="yellow"
          />
          <MetricCard
            label="Notices"
            value={run.notices}
            icon={<Info className="h-4 w-4" />}
            accent="blue"
          />
        </div>
      </div>

      {/* Metadata row */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <MetaItem
            icon={<FileSearch className="h-4 w-4" />}
            label="Pages Crawled"
            value={run.pagesCrawled.toLocaleString()}
          />
          <MetaItem
            icon={<Timer className="h-4 w-4" />}
            label="Duration"
            value={duration}
          />
          <MetaItem
            icon={<CalendarDays className="h-4 w-4" />}
            label="Date"
            value={new Date(run.startedAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          />
          <MetaItem
            icon={<StatusDot status={run.status} />}
            label="Status"
            value={titleCase(run.status)}
          />
        </CardContent>
      </Card>

      {/* Score breakdown */}
      <ScoreBreakdown issues={issues} />

      {/* Core Web Vitals */}
      <CoreWebVitalsCard issues={issues} cwvScore={run.cwvScore} />

      {/* Issues */}
      <IssuesList issues={issues} />

      {/* Crawled pages */}
      <CrawledPagesTable pages={run.crawledPages ?? []} />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Back to Audits
    </button>
  );
}

function HealthScoreCircle({ score }: { score: number }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const strokeColor =
    score >= 90 ? "#22c55e" : score >= 70 ? "#3b82f6" : score >= 50 ? "#eab308" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="160" height="160" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-4xl font-bold tabular-nums" style={{ color: strokeColor }}>
          {score}
        </div>
        <div className="text-xs text-muted-foreground">/100</div>
      </div>
    </div>
  );
}

function ScoreBandLabel({ score }: { score: number }) {
  const { label, cls } =
    score >= 90
      ? { label: "Excellent", cls: "text-green-600 bg-green-100 dark:bg-green-900/30" }
      : score >= 70
      ? { label: "Good", cls: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" }
      : score >= 50
      ? { label: "Needs Work", cls: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30" }
      : { label: "Critical", cls: "text-red-600 bg-red-100 dark:bg-red-900/30" };
  return (
    <span className={cn("rounded-full px-3 py-0.5 text-xs font-semibold", cls)}>{label}</span>
  );
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: AuditRun["status"] }) {
  const cls =
    status === "completed"
      ? "bg-green-500"
      : status === "running"
      ? "bg-blue-500"
      : status === "failed"
      ? "bg-red-500"
      : "bg-gray-400";
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", cls)} />;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

function CoreWebVitalsCard({
  issues,
  cwvScore,
}: {
  issues: IssueRow[];
  cwvScore: number | null;
}) {
  const cwv = issues.filter((i) => i.category === "cwv");
  const lcpFail = cwv.find((i) => i.title.toLowerCase().includes("lcp"));
  const clsFail = cwv.find((i) => i.title.toLowerCase().includes("cls"));
  const perfFail = cwv.find((i) => i.title.toLowerCase().includes("performance"));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Core Web Vitals</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <CwvMetric
          label="LCP"
          subtitle="Largest Contentful Paint"
          fail={!!lcpFail}
          detail={lcpFail ? lcpFail.description : cwvScore !== null ? "LCP is within acceptable range." : "No data"}
          threshold="< 2.5s"
        />
        <CwvMetric
          label="CLS"
          subtitle="Cumulative Layout Shift"
          fail={!!clsFail}
          detail={clsFail ? clsFail.description : cwvScore !== null ? "CLS is within acceptable range." : "No data"}
          threshold="< 0.1"
        />
        <CwvMetric
          label="Performance"
          subtitle="PageSpeed Score"
          fail={!!perfFail}
          detail={
            perfFail
              ? perfFail.description
              : cwvScore !== null
              ? "Performance score is acceptable."
              : "No data"
          }
          threshold="> 50"
        />
      </CardContent>
    </Card>
  );
}

function CwvMetric({
  label,
  subtitle,
  fail,
  detail,
  threshold,
}: {
  label: string;
  subtitle: string;
  fail: boolean;
  detail: string;
  threshold: string;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {fail ? (
          <span className="inline-flex items-center rounded-full bg-destructive px-2.5 py-0.5 text-xs font-semibold text-destructive-foreground">
            Fail
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-green-500 px-2.5 py-0.5 text-xs font-semibold text-green-600">
            Pass
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{detail}</p>
      <p className="text-xs text-muted-foreground">Threshold: {threshold}</p>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Skeleton className="h-5 w-24" />
      <div className="grid gap-6 md:grid-cols-[180px_1fr]">
        <Skeleton className="h-40 w-40 rounded-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-14" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
      <Card>
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
