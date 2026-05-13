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
}

export function IssuesSummary({
  hasAudit,
  criticalIssues,
  warnings,
  notices,
  pagesCrawled,
}: Props) {
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
    </div>
  );
}
