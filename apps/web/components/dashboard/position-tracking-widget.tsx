"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { SC, SemWidget, ViewReport } from "./sem-widget";

interface VisibilityPoint {
  date: string;
  visibility_score: number;
}

const POSITION_BUCKETS = [
  { key: "top3",     label: "Top 3",   newKw: 2, lostKw: 0, color: "#22c55e" },
  { key: "p4_10",   label: "Top 10",  newKw: 4, lostKw: 1, color: "#4285F4" },
  { key: "p11_20",  label: "Top 20",  newKw: 3, lostKw: 2, color: "#eab308" },
  { key: "p21_100", label: "Top 100", newKw: 5, lostKw: 4, color: "#f97316" },
] as const;

// Merge p21_50 + p51_100 from distribution
function mergeDistribution(dist: Record<string, number>) {
  return {
    top3:    dist["top3"]     ?? 0,
    p4_10:  dist["p4_10"]   ?? 0,
    p11_20: dist["p11_20"]  ?? 0,
    p21_100: (dist["p21_50"] ?? 0) + (dist["p51_100"] ?? 0) + (dist["p100plus"] ?? 0),
  };
}

interface Props {
  visibility: VisibilityPoint[];
  keywordDistribution: Record<string, number>;
  latestVisibility: number | null;
  isSample: boolean;
}

export function PositionTrackingWidget({
  visibility,
  keywordDistribution,
  latestVisibility,
  isSample,
}: Props) {
  const displayScore = latestVisibility ?? 51;
  // Reverse so chart reads left-to-right oldest → newest
  const chartData = [...visibility].reverse();
  const merged = mergeDistribution(keywordDistribution);
  const hasDistData = Object.values(keywordDistribution).some((v) => v > 0);

  const bucketData = POSITION_BUCKETS.map((b) => ({
    ...b,
    count: hasDistData ? (merged[b.key as keyof typeof merged] ?? 0) : ([8, 22, 31, 28][POSITION_BUCKETS.indexOf(b)]!),
  }));

  return (
    <SemWidget
      title="Position Tracking"
      accentColor={SC.blue}
      headerRight={
        <div className="flex items-center gap-2">
          {isSample && <SampleDataBadge />}
          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "#EEF2FF", color: SC.purple }}>
            Last 30 days
          </span>
        </div>
      }
    >
      <div className="grid grid-cols-5 gap-5">
        {/* LEFT — Visibility chart (3 cols) */}
        <div className="col-span-3 space-y-3">
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold tabular-nums leading-none" style={{ color: SC.blue }}>
              {displayScore.toFixed(1)}%
            </span>
            <span className="text-sm font-medium mb-0.5" style={{ color: SC.green }}>↑ +2.4%</span>
          </div>
          <p className="text-xs" style={{ color: SC.muted }}>Visibility score vs. last month</p>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="posGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SC.blue} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={SC.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F5" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) =>
                    new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short" })
                  }
                  tick={{ fontSize: 10, fill: SC.muted }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: SC.muted }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #F0F0F5",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v}`, "Visibility"]}
                  labelFormatter={(v: string) =>
                    new Date(v).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
                  }
                />
                <Area
                  type="monotone"
                  dataKey="visibility_score"
                  stroke={SC.blue}
                  strokeWidth={2}
                  fill="url(#posGradient)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <ViewReport href="/dashboard/rank-tracker" />
        </div>

        {/* RIGHT — Position buckets (2 cols) */}
        <div className="col-span-2 space-y-2.5">
          <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: SC.muted }}>
            Keywords by position
          </p>
          {bucketData.map((b) => (
            <div
              key={b.key}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
              style={{ backgroundColor: "#F8F9FA" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: b.color }}
                />
                <span className="text-xs font-medium truncate" style={{ color: SC.text }}>
                  {b.label}
                </span>
              </div>
              <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: SC.text }}>
                {b.count}
              </span>
              <div className="flex gap-1 shrink-0 text-[10px] font-medium">
                <span style={{ color: SC.green }}>↑{b.newKw}</span>
                <span style={{ color: SC.red }}>↓{b.lostKw}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SemWidget>
  );
}
