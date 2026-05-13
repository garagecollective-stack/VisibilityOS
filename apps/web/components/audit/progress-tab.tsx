"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ProgressDataPoint {
  id: string;
  createdAt: string;
  healthScore: number;
  totalIssues: number;
  criticalIssues: number;
  warnings: number;
  notices: number;
  pagesCrawled: number;
}

type MetricKey = "healthScore" | "totalIssues" | "criticalIssues" | "warnings" | "notices";

const LINES: Array<{ key: MetricKey; label: string; color: string; axis: "left" | "right" }> = [
  { key: "healthScore", label: "Health Score", color: "#22c55e", axis: "left" },
  { key: "totalIssues", label: "Total Issues", color: "#94a3b8", axis: "right" },
  { key: "criticalIssues", label: "Critical", color: "#ef4444", axis: "right" },
  { key: "warnings", label: "Warnings", color: "#eab308", axis: "right" },
  { key: "notices", label: "Notices", color: "#3b82f6", axis: "right" },
];

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

export function ProgressTab({ projectId, currentRunId }: Props) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [activeLines, setActiveLines] = useState<Set<MetricKey>>(new Set(["healthScore"]));

  const progressQuery = useQuery({
    queryKey: ["auditProgress", projectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ data: ProgressDataPoint[] }>(`/audit/progress/${projectId}`, {
        token: token ?? undefined,
      });
    },
  });

  const toggle = (key: MetricKey) => {
    setActiveLines((prev) => {
      const next = new Set(prev);
      if (next.has(key) && next.size > 1) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (progressQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const data = progressQuery.data?.data ?? [];
  const chartData = data.map((d) => ({ ...d, date: formatDate(d.createdAt) }));
  const hasIssueLines = [...activeLines].some((k) => k !== "healthScore");

  return (
    <div className="space-y-5">
      {/* Metric toggles */}
      <div className="flex flex-wrap gap-2">
        {LINES.map((line) => {
          const active = activeLines.has(line.key);
          return (
            <button
              key={line.key}
              type="button"
              onClick={() => toggle(line.key)}
              style={active ? { backgroundColor: line.color, borderColor: line.color } : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "text-white"
                  : "border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/60"
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: active ? "white" : line.color }}
              />
              {line.label}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Progress Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              No completed audits found for this project.
            </div>
          ) : (
            <div className="space-y-2">
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 8, right: hasIssueLines ? 48 : 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  {hasIssueLines && (
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  )}
                  <Tooltip />
                  {[...activeLines].map((key) => {
                    const line = LINES.find((l) => l.key === key)!;
                    return (
                      <Line
                        key={key}
                        yAxisId={line.axis}
                        type="monotone"
                        dataKey={key}
                        stroke={line.color}
                        strokeWidth={2}
                        dot={{ r: 4, fill: line.color }}
                        activeDot={{ r: 6 }}
                        name={line.label}
                      />
                    );
                  })}
                </ComposedChart>
              </ResponsiveContainer>
              {data.length === 1 && (
                <p className="text-center text-xs text-muted-foreground">
                  Run more audits to track your progress over time.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data table */}
      {data.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 text-left">Date</th>
                    <th className="px-4 py-2.5 text-right">Score</th>
                    <th className="px-4 py-2.5 text-right">Pages</th>
                    <th className="px-4 py-2.5 text-right">Issues</th>
                    <th className="px-4 py-2.5 text-right">Critical</th>
                    <th className="px-4 py-2.5 text-right">Warnings</th>
                    <th className="px-4 py-2.5 text-right">Notices</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...data].reverse().map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => router.push(`/dashboard/audit/${row.id}`)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/30",
                        row.id === currentRunId && "bg-primary/5"
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{formatDate(row.createdAt)}</span>
                        {row.id === currentRunId && (
                          <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            Current
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <ScoreChip score={row.healthScore} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {row.pagesCrawled.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {row.totalIssues}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-red-600 dark:text-red-400">
                        {row.criticalIssues}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-yellow-600 dark:text-yellow-400">
                        {row.warnings}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-blue-600 dark:text-blue-400">
                        {row.notices}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScoreChip({ score }: { score: number }) {
  const color =
    score >= 90
      ? "text-green-600 dark:text-green-400"
      : score >= 70
      ? "text-blue-600 dark:text-blue-400"
      : score >= 50
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-600 dark:text-red-400";
  return <span className={cn("font-bold tabular-nums", color)}>{score}</span>;
}
