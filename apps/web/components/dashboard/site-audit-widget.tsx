"use client";

import Link from "next/link";
import { CircularScore, scoreColor } from "@/components/shared/circular-score";
import { SC, SemWidget } from "./sem-widget";

interface AuditRun {
  id: string;
  technicalScore: number | null;
  pagesCrawled: number;
  criticalIssues: number;
  warnings: number;
  notices: number;
  completedAt: string | null;
}

interface Props {
  latestRun: AuditRun | null;
  pagesWithIssues: number;
}

export function SiteAuditWidget({ latestRun, pagesWithIssues }: Props) {
  const hasRun = !!latestRun;
  const score = latestRun?.technicalScore ?? null;
  const pagesCrawled = latestRun?.pagesCrawled ?? 0;
  const criticalIssues = latestRun?.criticalIssues ?? 0;
  const warnings = latestRun?.warnings ?? 0;
  const notices = latestRun?.notices ?? 0;
  const cleanPages = Math.max(0, pagesCrawled - pagesWithIssues);

  const total = pagesCrawled || 1;
  const cleanPct = (cleanPages / total) * 100;
  const issuePct = (pagesWithIssues / total) * 100;

  // proportion of issue pages: critical vs warning vs notice
  const issueTotal = criticalIssues + warnings + notices || 1;
  const critPct = (criticalIssues / issueTotal) * issuePct;
  const warnPct = (warnings / issueTotal) * issuePct;
  const noticePct = issuePct - critPct - warnPct;

  const updatedAt = latestRun?.completedAt
    ? new Date(latestRun.completedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const auditHref = latestRun ? `/dashboard/audit/${latestRun.id}` : "/dashboard/audit";

  return (
    <SemWidget
      title="Site Audit"
      accentColor={SC.orange}
      headerRight={
        updatedAt ? (
          <span className="text-xs" style={{ color: SC.muted }}>Updated: {updatedAt}</span>
        ) : undefined
      }
    >
      {!hasRun ? (
        <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
          <p className="text-sm" style={{ color: SC.muted }}>No audit run yet</p>
          <Link
            href="/dashboard/audit"
            className="text-sm px-4 py-1.5 rounded font-medium"
            style={{ backgroundColor: SC.orange, color: "#fff" }}
          >
            Run First Audit
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6 items-start">
          {/* Left — Score + issue counts */}
          <div className="flex flex-col items-center gap-3">
            <CircularScore score={score} size={80} thickness={8} />
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: SC.muted }}>Errors</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: SC.red }}>
                  {criticalIssues}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: SC.muted }}>Warnings</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: SC.orange }}>
                  {warnings}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: SC.muted }}>Notices</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: SC.blue }}>
                  {notices}
                </span>
              </div>
            </div>
          </div>

          {/* Right — Pages breakdown (2 cols) */}
          <div className="col-span-2 space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: SC.muted }}>
                Crawled pages
              </p>
              <p className="text-3xl font-bold tabular-nums" style={{ color: SC.blue }}>
                {pagesCrawled.toLocaleString()}
              </p>
            </div>

            {/* Stacked bar */}
            <div className="space-y-1.5">
              <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ backgroundColor: "#F0F0F5" }}>
                <div className="h-full" style={{ width: `${cleanPct}%`, backgroundColor: SC.green }} />
                <div className="h-full" style={{ width: `${warnPct}%`, backgroundColor: SC.orange }} />
                <div className="h-full" style={{ width: `${critPct}%`, backgroundColor: SC.red }} />
                <div className="h-full" style={{ width: `${noticePct}%`, backgroundColor: "#94A3B8" }} />
              </div>
              <div className="flex gap-3 text-[10px]" style={{ color: SC.muted }}>
                <span><span style={{ color: SC.green }}>●</span> {cleanPages} healthy</span>
                <span><span style={{ color: SC.orange }}>●</span> {warnings} warnings</span>
                <span><span style={{ color: SC.red }}>●</span> {criticalIssues} errors</span>
              </div>
            </div>

            <Link
              href={auditHref}
              className="block w-full text-center text-sm px-3 py-1.5 rounded transition-colors"
              style={{ color: "#4285F4", border: "1px solid #E5E7EB" }}
            >
              View full report →
            </Link>
          </div>
        </div>
      )}
    </SemWidget>
  );
}
