"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import { KdBadge } from "@/components/keywords/kd-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMetric } from "@/lib/keywords";

interface Keyword {
  keyword: string;
  search_volume: number;
  keyword_difficulty: number | null;
  cpc: number;
}

interface Cluster {
  topic: string;
  keywords: Keyword[];
  totalVolume: number;
}

const STOPWORDS = new Set([
  "best", "top", "how", "what", "is", "are", "a", "an", "the", "to", "for",
  "of", "and", "or", "in", "with", "vs", "versus", "free", "cheap", "online",
  "do", "does", "can", "will", "my", "your", "get", "use", "using", "used",
]);

function getClusterKey(keyword: string): string {
  const words = keyword.toLowerCase().split(/\s+/);
  for (const word of words) {
    if (word.length > 2 && !STOPWORDS.has(word)) return word;
  }
  return words[0] ?? keyword;
}

function buildClusters(keywords: Keyword[]): Cluster[] {
  const map = new Map<string, Keyword[]>();
  for (const kw of keywords) {
    const key = getClusterKey(kw.keyword);
    const existing = map.get(key) ?? [];
    map.set(key, [...existing, kw]);
  }

  const other: Keyword[] = [];
  const clusters: Cluster[] = [];

  for (const [topic, kws] of map.entries()) {
    const sorted = [...kws].sort((a, b) => b.search_volume - a.search_volume);
    if (kws.length >= 2) {
      clusters.push({
        topic: topic.charAt(0).toUpperCase() + topic.slice(1),
        keywords: sorted,
        totalVolume: sorted.reduce((s, k) => s + k.search_volume, 0),
      });
    } else {
      other.push(...kws);
    }
  }

  if (other.length > 0) {
    const sorted = [...other].sort((a, b) => b.search_volume - a.search_volume);
    clusters.push({
      topic: "Other Topics",
      keywords: sorted,
      totalVolume: sorted.reduce((s, k) => s + k.search_volume, 0),
    });
  }

  return clusters.sort((a, b) => {
    if (a.topic === "Other Topics") return 1;
    if (b.topic === "Other Topics") return -1;
    return b.totalVolume - a.totalVolume;
  });
}

interface Props {
  keywords: Keyword[];
}

export function KeywordClustersPanel({ keywords }: Props) {
  const clusters = buildClusters(keywords);
  const [open, setOpen] = useState<Set<string>>(
    new Set(clusters.slice(0, 3).map((c) => c.topic))
  );

  if (clusters.length === 0) return null;

  const toggle = (topic: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Keyword Topic Clusters</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          {keywords.length} related keywords across {clusters.length} cluster{clusters.length !== 1 ? "s" : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {clusters.map((cluster) => {
          const isOpen = open.has(cluster.topic);
          return (
            <div key={cluster.topic} className="overflow-hidden rounded-md border">
              <button
                type="button"
                onClick={() => toggle(cluster.topic)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-accent"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {cluster.topic}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                    {cluster.keywords.length}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  ~{formatMetric(cluster.totalVolume)} vol
                </span>
              </button>
              {isOpen && (
                <div className="divide-y border-t">
                  {cluster.keywords.map((kw) => (
                    <div key={kw.keyword} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1">{kw.keyword}</span>
                      <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                        {formatMetric(kw.search_volume)}
                      </span>
                      <KdBadge value={kw.keyword_difficulty} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
