"use client";

import Link from "next/link";
import { AlertTriangle, FileSearch, Info, XCircle } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";

interface Props {
  hasAudit: boolean;
  criticalIssues: number;
  warnings: number;
  notices: number;
  pagesCrawled: number;
  pagesWithIssues?: number;
}

export function IssuesSummary({
  hasAudit,
  criticalIssues,
  warnings,
  notices,
  pagesCrawled,
  pagesWithIssues = 0,
}: Props) {
  const issuesPct =
    hasAudit && pagesCrawled > 0
      ? Math.round((pagesWithIssues / pagesCrawled) * 100)
      : null;
  const cleanPct = issuesPct !== null ? 100 - issuesPct : null;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Site Issues Summary</h2>
          <p className="text-xs text-muted-foreground">
            {hasAudit ? "From the most recent audit run" : "Run a site audit to populate this section"}
          </p>
        </div>
        <Link
          href="/dashboard/audit"
          className="text-xs font-medium text-primary hover:underline"
        >
          Go to Site Audit →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Critical Issues"
          value={hasAudit ? criticalIssues : "—"}
          icon={<XCircle className="h-4 w-4" />}
          accent="red"
        />
        <MetricCard
          label="Warnings"
          value={hasAudit ? warnings : "—"}
          icon={<AlertTriangle className="h-4 w-4" />}
          accent="yellow"
        />
        <MetricCard
          label="Notices"
          value={hasAudit ? notices : "—"}
          icon={<Info className="h-4 w-4" />}
          accent="blue"
        />
        <MetricCard
          label="Pages Crawled"
          value={hasAudit ? pagesCrawled : "—"}
          icon={<FileSearch className="h-4 w-4" />}
          accent="default"
        />
      </div>

      {/* Pages with issues bar (Part 6) */}
      {hasAudit && issuesPct !== null && (
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{pagesWithIssues}</span> of{" "}
              <span className="font-semibold text-foreground">{pagesCrawled}</span> pages have at least 1 issue
            </span>
            <span className="tabular-nums font-semibold text-red-600 dark:text-red-400">
              {issuesPct}%
            </span>
          </div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-l-full bg-red-500 transition-[width] duration-700"
              style={{ width: `${issuesPct}%` }}
            />
            <div
              className="h-full rounded-r-full bg-green-500 transition-[width] duration-700"
              style={{ width: `${cleanPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{pagesWithIssues} with issues</span>
            <span>{pagesCrawled - pagesWithIssues} clean</span>
          </div>
        </div>
      )}
    </div>
  );
}
