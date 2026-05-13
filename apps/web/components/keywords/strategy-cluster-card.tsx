"use client";

import { useState } from "react";
import { Bookmark, ChevronDown, ChevronRight, FileText, Sparkles } from "lucide-react";
import { KdBadge } from "@/components/keywords/kd-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatMetric, type StrategyCluster } from "@/lib/keywords";
import { cn } from "@/lib/utils";

interface Props {
  cluster: StrategyCluster;
  defaultOpen?: boolean;
  onSaveKeyword: (keyword: string) => void;
  onSaveCluster: (keywords: string[]) => void;
}

export function StrategyClusterCard({
  cluster,
  defaultOpen = true,
  onSaveKeyword,
  onSaveCluster,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const total = 1 + cluster.supporting_keywords.length;
  const quickWins = cluster.supporting_keywords.filter((k) => k.is_quick_win).length;

  const handleSaveAll = () => {
    const all = [cluster.pillar_page.keyword, ...cluster.supporting_keywords.map((k) => k.keyword)];
    onSaveCluster(Array.from(new Set(all)));
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer pb-3" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <h3 className="text-base font-semibold">{cluster.topic}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {total}
            </span>
            {quickWins > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Sparkles className="h-3 w-3" />
                {quickWins} quick win{quickWins === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-3 pt-0">
          {/* Pillar page row */}
          <div className="space-y-2 rounded-md border-2 border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-1 items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  <FileText className="h-3 w-3" />
                  Pillar Page
                </span>
                <span className="text-sm font-semibold">{cluster.pillar_page.keyword}</span>
              </div>
              <button
                type="button"
                title="Save to list"
                onClick={() => onSaveKeyword(cluster.pillar_page.keyword)}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Bookmark className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                Volume{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatMetric(cluster.pillar_page.volume)}
                </span>
              </span>
              <span className="text-muted-foreground">
                KD <KdBadge value={cluster.pillar_page.kd} className="ml-1 align-middle" />
              </span>
              <span className="inline-flex items-center rounded-md border bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {cluster.pillar_page.content_type}
              </span>
            </div>
          </div>

          {/* Supporting keywords */}
          <ul className="divide-y rounded-md border bg-background">
            {cluster.supporting_keywords.map((kw, i) => (
              <li
                key={`${kw.keyword}-${i}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5",
                  kw.is_quick_win && "border-l-2 border-l-green-400 bg-green-50/60 dark:bg-green-950/20"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{kw.keyword}</p>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="tabular-nums">Vol {formatMetric(kw.volume)}</span>
                    <span>
                      KD <KdBadge value={kw.kd} className="ml-0.5 align-middle" />
                    </span>
                    {kw.is_quick_win && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <Sparkles className="h-2.5 w-2.5" />
                        Quick Win
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  title="Save to list"
                  onClick={() => onSaveKeyword(kw.keyword)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Bookmark className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex justify-end pt-1">
            <Button variant="outline" size="sm" onClick={handleSaveAll}>
              <Bookmark className="mr-1.5 h-3.5 w-3.5" />
              Save All in Cluster ({total})
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
