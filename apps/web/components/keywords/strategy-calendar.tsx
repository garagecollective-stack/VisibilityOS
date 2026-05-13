"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMetric, type StrategyCalendarItem } from "@/lib/keywords";
import { cn } from "@/lib/utils";

interface Props {
  items: StrategyCalendarItem[];
  quickWinKeywords: Set<string>;
}

const DEFAULT_WEEKS = 8;

export function StrategyCalendar({ items, quickWinKeywords }: Props) {
  const [showAll, setShowAll] = useState(false);

  const grouped = groupByWeek(items);
  const allWeeks = Object.keys(grouped)
    .map((n) => parseInt(n, 10))
    .sort((a, b) => a - b);
  const visibleWeeks = showAll ? allWeeks : allWeeks.filter((w) => w <= DEFAULT_WEEKS);
  const hiddenCount = allWeeks.length - visibleWeeks.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-lg">Content Calendar</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Prioritized content production order, quick wins first.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {visibleWeeks.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No content calendar items returned.
          </div>
        ) : (
          <div className="space-y-5">
            {visibleWeeks.map((week) => {
              const weekItems = grouped[week] ?? [];
              return (
                <div key={week} className="relative space-y-2 pl-6">
                  <div className="absolute left-0 top-0 flex h-full w-6 justify-center">
                    <span className="absolute top-1 h-2 w-2 rounded-full bg-primary" />
                    <span className="absolute inset-y-3 left-1/2 -translate-x-1/2 w-px bg-border" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Week {week}
                  </p>
                  <ul className="space-y-1.5">
                    {weekItems.map((item, idx) => {
                      const quickWin = quickWinKeywords.has(item.keyword);
                      return (
                        <li
                          key={`${item.keyword}-${idx}`}
                          className={cn(
                            "flex items-center gap-3 rounded-md border bg-background px-3 py-2",
                            quickWin && "border-green-300 bg-green-50/60 dark:border-green-900/40 dark:bg-green-950/20"
                          )}
                        >
                          <PriorityDot priority={item.priority} />
                          <span className="inline-flex items-center rounded-md border bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {item.content_type}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                            {item.keyword}
                          </span>
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                            {formatMetric(item.estimated_volume)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {hiddenCount > 0 && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
              Show Full Calendar ({hiddenCount} more week{hiddenCount === 1 ? "" : "s"})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function groupByWeek(items: StrategyCalendarItem[]): Record<number, StrategyCalendarItem[]> {
  const groups: Record<number, StrategyCalendarItem[]> = {};
  for (const item of items) {
    if (!groups[item.week]) groups[item.week] = [];
    groups[item.week]!.push(item);
  }
  return groups;
}

function PriorityDot({ priority }: { priority: StrategyCalendarItem["priority"] }) {
  const cls =
    priority === "high"
      ? "bg-red-500"
      : priority === "medium"
      ? "bg-yellow-500"
      : "bg-green-500";
  return (
    <span
      title={`Priority: ${priority}`}
      className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", cls)}
    />
  );
}
