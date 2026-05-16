"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { SemWidget } from "./sem-widget";
import { cn } from "@/lib/utils";

interface PageSpeedData {
  mobile: number | null;
  desktop: number | null;
  lcp_ms: number | null;
  cls: number | null;
  last_checked: string;
}

interface Props {
  pagespeed: PageSpeedData | null;
  auditHref?: string;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#00C48C";
  if (score >= 50) return "#FF8C00";
  return "#F34E4E";
}

function ScoreCircle({ label, score }: { label: string; score: number | null }) {
  const color = score != null ? scoreColor(score) : "#9CA3AF";
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const pct = score != null ? score / 100 : 0;
  const dash = pct * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg width={56} height={56} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={28} cy={28} r={radius} fill="none" stroke="#F0F0F5" strokeWidth={6} />
          <circle
            cx={28}
            cy={28}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="round"
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums"
          style={{ color }}
        >
          {score != null ? score : "—"}
        </div>
      </div>
      <span className="text-[11px]" style={{ color: "#6B7280" }}>{label}</span>
    </div>
  );
}

function MetricIcon({ good }: { good: boolean }) {
  return (
    <span className={cn("text-xs font-semibold", good ? "text-green-600" : "text-orange-500")}>
      {good ? "✅" : "⚠️"}
    </span>
  );
}

function hoursAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h === 1) return "1h ago";
  return `${h}h ago`;
}

export function PageSpeedWidget({ pagespeed, auditHref = "/dashboard/audit" }: Props) {
  if (!pagespeed) {
    return (
      <SemWidget
        title="Page Speed"
        accentColor="#FF8C00"
        headerRight={<Zap className="h-4 w-4" style={{ color: "#FF8C00" }} />}
      >
        <p className="text-xs text-center py-2" style={{ color: "#6B7280" }}>
          Run an audit to see PageSpeed data
        </p>
        <div className="mt-3">
          <Link
            href={auditHref}
            className="block w-full text-center text-sm px-3 py-1.5 rounded"
            style={{ color: "#4285F4", border: "1px solid #E5E7EB" }}
          >
            Run Audit →
          </Link>
        </div>
      </SemWidget>
    );
  }

  const lcpOk = pagespeed.lcp_ms != null && pagespeed.lcp_ms <= 2500;
  const clsOk = pagespeed.cls != null && pagespeed.cls <= 0.1;

  return (
    <SemWidget
      title="Page Speed"
      accentColor="#FF8C00"
      headerRight={<Zap className="h-4 w-4" style={{ color: "#FF8C00" }} />}
    >
      {/* Score circles */}
      <div className="flex justify-around mb-4">
        <ScoreCircle label="Mobile" score={pagespeed.mobile} />
        <ScoreCircle label="Desktop" score={pagespeed.desktop} />
      </div>

      {/* Metric rows */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: "#6B7280" }}>LCP</span>
          <div className="flex items-center gap-1.5">
            <span className="tabular-nums font-medium" style={{ color: "#1A1A2E" }}>
              {pagespeed.lcp_ms != null ? `${(pagespeed.lcp_ms / 1000).toFixed(1)}s` : "—"}
            </span>
            <MetricIcon good={lcpOk} />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: "#6B7280" }}>CLS</span>
          <div className="flex items-center gap-1.5">
            <span className="tabular-nums font-medium" style={{ color: "#1A1A2E" }}>
              {pagespeed.cls != null ? pagespeed.cls.toFixed(3) : "—"}
            </span>
            <MetricIcon good={clsOk} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-3 text-[11px] text-center" style={{ color: "#9CA3AF" }}>
        Last checked {hoursAgo(pagespeed.last_checked)}
      </p>
      <div className="mt-2">
        <Link
          href={auditHref}
          className="block w-full text-center text-sm px-3 py-1.5 rounded"
          style={{ color: "#4285F4", border: "1px solid #E5E7EB" }}
        >
          View full audit →
        </Link>
      </div>
    </SemWidget>
  );
}
