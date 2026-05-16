"use client";

import { useState } from "react";
import { CheckCheck, Copy, ExternalLink, FileText, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ReportSummary {
  id: string;
  title: string;
  type: string;
  status: "pending" | "generating" | "ready" | "failed";
  dateRange: string;
  createdAt: string;
  completedAt: string | null;
  failureReason: string | null;
  projectName: string;
  projectDomain: string;
}

const TYPE_LABELS: Record<string, string> = {
  full_seo: "Full SEO",
  audit_report: "Site Audit",
  keyword_report: "Keyword",
  custom: "GSC Performance",
  backlink_report: "Backlinks",
  competitor_report: "Competitors",
};

const TYPE_COLORS: Record<string, string> = {
  full_seo: "bg-amber-100 text-amber-700",
  audit_report: "bg-orange-100 text-orange-700",
  keyword_report: "bg-green-100 text-green-700",
  custom: "bg-blue-100 text-blue-700",
  backlink_report: "bg-purple-100 text-purple-700",
  competitor_report: "bg-pink-100 text-pink-700",
};

function StatusBadge({ status }: { status: ReportSummary["status"] }) {
  if (status === "generating" || status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-blue-600">
        <Loader2 className="h-3 w-3 animate-spin" />
        Generating…
      </span>
    );
  }
  if (status === "ready") {
    return <span className="text-xs font-medium text-green-600">Ready</span>;
  }
  return <span className="text-xs font-medium text-destructive">Failed</span>;
}

interface Props {
  report: ReportSummary;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}

export function ReportCard({ report, onDelete, onView }: Props) {
  const [copied, setCopied] = useState(false);

  const createdDate = new Date(report.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  async function handleShare() {
    const url = `${window.location.origin}/dashboard/reports/${report.id}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-4 flex items-start gap-4 transition-shadow hover:shadow-sm",
        report.status === "failed" && "border-destructive/30 bg-destructive/5"
      )}
    >
      {/* Icon */}
      <div className="shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
        <FileText className="h-4.5 w-4.5 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{report.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{report.projectName} · {report.projectDomain}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TYPE_COLORS[report.type] ?? "bg-gray-100 text-gray-600")}>
              {TYPE_LABELS[report.type] ?? report.type}
            </span>
            <StatusBadge status={report.status} />
          </div>
        </div>

        <p className="mt-1 text-[11px] text-muted-foreground">Generated {createdDate}</p>

        {report.status === "failed" && report.failureReason && (
          <p className="mt-1 text-xs text-destructive">{report.failureReason}</p>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          {report.status === "ready" && (
            <>
              <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => onView(report.id)}>
                <ExternalLink className="h-3 w-3" />
                View / Print
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleShare}>
                {copied ? <CheckCheck className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied!" : "Share link"}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive ml-auto"
            onClick={() => onDelete(report.id)}
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
