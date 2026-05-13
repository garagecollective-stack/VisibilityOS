"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IssueRow } from "./issues-list";

interface CrawledPageSummary {
  url: string;
  status_code: number;
  word_count: number;
  issues_count: number;
  has_meta_desc?: boolean;
  has_h1?: boolean;
  has_json_ld?: boolean;
  has_canonical?: boolean;
  incoming_links_count?: number;
}

interface Props {
  pages: CrawledPageSummary[];
  issues: IssueRow[];
}

const STATUS_COLORS = {
  "2xx": "#22c55e",
  "3xx": "#3b82f6",
  "4xx": "#f97316",
  "5xx": "#ef4444",
};

export function StatisticsTab({ pages, issues }: Props) {
  const statusData = useMemo(() => {
    const counts = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
    for (const p of pages) {
      if (p.status_code >= 200 && p.status_code < 300) counts["2xx"]++;
      else if (p.status_code >= 300 && p.status_code < 400) counts["3xx"]++;
      else if (p.status_code >= 400 && p.status_code < 500) counts["4xx"]++;
      else if (p.status_code >= 500) counts["5xx"]++;
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name,
        value,
        fill: STATUS_COLORS[name as keyof typeof STATUS_COLORS],
      }));
  }, [pages]);

  const depthData = useMemo(() => {
    const counts: Record<string, number> = {
      "1 level": 0,
      "2 levels": 0,
      "3 levels": 0,
      "4+ levels": 0,
    };
    for (const p of pages) {
      try {
        const slashes = new URL(p.url).pathname.split("/").filter(Boolean).length;
        if (slashes <= 1) counts["1 level"]++;
        else if (slashes === 2) counts["2 levels"]++;
        else if (slashes === 3) counts["3 levels"]++;
        else counts["4+ levels"]++;
      } catch {
        counts["1 level"]++;
      }
    }
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      fill: name === "4+ levels" ? "#ef4444" : "#3b82f6",
    }));
  }, [pages]);

  const wordCountData = useMemo(() => {
    const buckets = [
      { name: "< 300 words", min: 0, max: 299, fill: "#ef4444", count: 0 },
      { name: "300–1500", min: 300, max: 1499, fill: "#22c55e", count: 0 },
      { name: "1500–3000", min: 1500, max: 2999, fill: "#3b82f6", count: 0 },
      { name: "3000+", min: 3000, max: Infinity, fill: "#8b5cf6", count: 0 },
    ];
    for (const p of pages) {
      const bucket = buckets.find((b) => p.word_count >= b.min && p.word_count <= b.max);
      if (bucket) bucket.count++;
    }
    return buckets;
  }, [pages]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const issue of issues) {
      counts[issue.category] = (counts[issue.category] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name: name.replace("_", " "), count, fill: "#3b82f6" }));
  }, [issues]);

  const incomingLinksData = useMemo(() => {
    const buckets = [
      { name: "0 (orphan)", min: 0, max: 0, fill: "#ef4444", count: 0 },
      { name: "1 link", min: 1, max: 1, fill: "#f97316", count: 0 },
      { name: "2–5 links", min: 2, max: 5, fill: "#eab308", count: 0 },
      { name: "6–15 links", min: 6, max: 15, fill: "#22c55e", count: 0 },
      { name: "16+ links", min: 16, max: Infinity, fill: "#3b82f6", count: 0 },
    ];
    for (const p of pages) {
      const count = p.incoming_links_count ?? 0;
      const bucket = buckets.find((b) => count >= b.min && count <= b.max);
      if (bucket) bucket.count++;
    }
    return buckets;
  }, [pages]);

  const markupData = useMemo(() => {
    const total = pages.length;
    if (total === 0) return [];
    return [
      { label: "H1 Tag", count: pages.filter((p) => p.has_h1).length },
      { label: "Meta Description", count: pages.filter((p) => p.has_meta_desc).length },
      { label: "Canonical Tag", count: pages.filter((p) => p.has_canonical).length },
      { label: "JSON-LD Structured Data", count: pages.filter((p) => p.has_json_ld).length },
    ].map((item) => ({ ...item, pct: Math.round((item.count / total) * 100) }));
  }, [pages]);

  if (pages.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No page data available for statistics.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* HTTP Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">HTTP Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} pages`, ""]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {statusData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                  <span>{entry.name} ({entry.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Crawl Depth Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Crawl Depth Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={depthData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v: number) => [`${v} pages`, "Pages"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {depthData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Word Count Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Word Count Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {wordCountData.map((bucket) => {
              const pct = pages.length === 0 ? 0 : Math.round((bucket.count / pages.length) * 100);
              return (
                <div key={bucket.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{bucket.name}</span>
                    <span className="tabular-nums font-medium">
                      {bucket.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${pct}%`, backgroundColor: bucket.fill }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Issues per Category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Issues per Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                No issues found.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={categoryData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, bottom: 0, left: 64 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v: number) => [`${v} issues`, "Issues"]} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Incoming Internal Links Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Incoming Internal Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={incomingLinksData}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v: number) => [`${v} pages`, "Pages"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {incomingLinksData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {(() => {
              const orphanCount = incomingLinksData[0]?.count ?? 0;
              const oneCount = incomingLinksData[1]?.count ?? 0;
              if (orphanCount + oneCount === 0) return null;
              return (
                <p className="pt-1 text-xs text-muted-foreground">
                  {orphanCount + oneCount} page{orphanCount + oneCount !== 1 ? "s" : ""} with 0 or 1 internal links may be hard for Google to discover.
                </p>
              );
            })()}
          </CardContent>
        </Card>

        {/* Page Markup Coverage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Page Markup Coverage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {markupData.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No data.</div>
            ) : (
              markupData.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="tabular-nums font-medium">
                      {item.count} pages ({item.pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${item.pct}%`,
                        backgroundColor: item.pct >= 80 ? "#22c55e" : item.pct >= 50 ? "#eab308" : "#ef4444",
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
