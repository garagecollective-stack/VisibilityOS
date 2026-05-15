"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ListChecks,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { SC, SemWidget } from "./sem-widget";
import { cn } from "@/lib/utils";

// ── Mini donut (SVG, no Recharts) ─────────────────────────────────────────────

function MiniDonut({
  slices,
  size = 64,
  thickness = 10,
}: {
  slices: Array<{ value: number; color: string }>;
  size: number;
  thickness: number;
}) {
  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((s, sl) => s + sl.value, 0) || 1;

  let offset = 0;
  const arcs = slices.map((sl) => {
    const pct = sl.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const startOffset = circumference - offset * circumference;
    offset += pct;
    return { ...sl, dash, gap, startOffset };
  });

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#F0F0F5" strokeWidth={thickness} />
      {arcs.map((arc, i) => (
        arc.value > 0 && (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={thickness}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={arc.startOffset}
          />
        )
      ))}
    </svg>
  );
}

// ── Quick Stats ───────────────────────────────────────────────────────────────

interface QuickStatsProps {
  domainAuthority: number | null;
  referringDomains: number | null;
  totalBacklinks: number | null;
  trackedKeywords: number;
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2" style={{ borderBottom: "1px solid #F0F0F5" }}>
      <span className="text-xs" style={{ color: SC.muted }}>{label}</span>
      <span className="text-sm font-semibold tabular-nums" style={{ color: SC.text }}>{value}</span>
    </div>
  );
}

export function QuickStatsWidget({ domainAuthority, referringDomains, totalBacklinks, trackedKeywords }: QuickStatsProps) {
  return (
    <SemWidget title="Quick Stats" accentColor={SC.purple} bodyClassName="py-2">
      <StatRow label="Domain Authority" value={domainAuthority != null ? `${domainAuthority}/100` : "—"} />
      <StatRow label="Referring Domains" value={referringDomains?.toLocaleString() ?? "—"} />
      <StatRow label="Total Backlinks" value={totalBacklinks?.toLocaleString() ?? "—"} />
      <StatRow label="Keywords Tracked" value={trackedKeywords} />
    </SemWidget>
  );
}

// ── Recent Alerts ─────────────────────────────────────────────────────────────

const SAMPLE_ALERTS = [
  { dot: SC.red, text: 'Rank dropped 6 positions for "competitor analysis tools"', time: "2h ago" },
  { dot: SC.orange, text: "Audit found 12 critical issues — missing meta descriptions", time: "Yesterday" },
  { dot: SC.blue, text: "23 new keyword opportunities discovered on /blog/*", time: "2d ago" },
  { dot: SC.red, text: "Visibility down 3.2 points — recovery expected next refresh", time: "3d ago" },
  { dot: SC.green, text: 'Ranking improved: "best seo tools" moved from #18 to #12', time: "4d ago" },
] as const;

export function AlertsWidget() {
  return (
    <SemWidget
      title="Recent Alerts"
      accentColor={SC.red}
      headerRight={<SampleDataBadge />}
      bodyClassName="py-2"
    >
      <div className="space-y-0">
        {SAMPLE_ALERTS.map((a, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 py-2.5"
            style={{ borderBottom: i < SAMPLE_ALERTS.length - 1 ? "1px solid #F0F0F5" : undefined }}
          >
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: a.dot }}
            />
            <p className="flex-1 text-xs leading-relaxed" style={{ color: SC.text }}>{a.text}</p>
            <span className="shrink-0 text-[10px]" style={{ color: SC.muted }}>{a.time}</span>
          </div>
        ))}
      </div>
    </SemWidget>
  );
}

// ── Issues Overview ───────────────────────────────────────────────────────────

interface IssuesProps {
  criticalIssues: number;
  warnings: number;
  notices: number;
  hasAudit: boolean;
  latestRunId?: string;
}

export function IssuesOverviewWidget({ criticalIssues, warnings, notices, hasAudit, latestRunId }: IssuesProps) {
  const total = criticalIssues + warnings + notices;
  const auditHref = latestRunId ? `/dashboard/audit/${latestRunId}` : "/dashboard/audit";

  const slices = [
    { value: hasAudit ? criticalIssues : 12, color: SC.red, label: "Critical", display: hasAudit ? criticalIssues : 12 },
    { value: hasAudit ? warnings : 47, color: SC.orange, label: "Warnings", display: hasAudit ? warnings : 47 },
    { value: hasAudit ? notices : 23, color: SC.blue, label: "Notices", display: hasAudit ? notices : 23 },
  ];

  return (
    <SemWidget
      title="Issues Overview"
      accentColor={SC.orange}
      headerRight={!hasAudit ? <SampleDataBadge /> : undefined}
    >
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <MiniDonut slices={slices} size={68} thickness={10} />
          <div
            className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums"
            style={{ color: SC.text }}
          >
            {hasAudit ? total : 82}
          </div>
        </div>
        <div className="space-y-1.5 flex-1">
          {slices.map((sl) => (
            <div key={sl.label} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5" style={{ color: SC.muted }}>
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: sl.color }} />
                {sl.label}
              </span>
              <span className="font-semibold tabular-nums" style={{ color: sl.color }}>{sl.display}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <Link
          href={auditHref}
          className="block w-full text-center text-sm px-3 py-1.5 rounded"
          style={{ color: "#4285F4", border: "1px solid #E5E7EB" }}
        >
          View full report →
        </Link>
      </div>
    </SemWidget>
  );
}

// ── Quick Actions ─────────────────────────────────────────────────────────────

const ACTIONS = [
  { label: "Run Site Audit", href: "/dashboard/audit", icon: ShieldCheck, color: SC.orange },
  { label: "Add Keywords", href: "/dashboard/keywords/lists", icon: ListChecks, color: SC.green },
  { label: "Check Rankings", href: "/dashboard/rank-tracker", icon: TrendingUp, color: SC.blue },
  { label: "Research Keyword", href: "/dashboard/keywords/overview", icon: Search, color: SC.purple },
] as const;

export function QuickActionsWidget() {
  return (
    <SemWidget title="Quick Actions" accentColor={SC.blue} bodyClassName="space-y-2">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors group"
            style={{ border: "1px solid #F0F0F5" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#F8F9FA"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: `${action.color}18` }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: action.color }} />
            </span>
            <span className="text-sm font-medium flex-1" style={{ color: SC.text }}>{action.label}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: SC.muted }} />
          </Link>
        );
      })}
    </SemWidget>
  );
}
