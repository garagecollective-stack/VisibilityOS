"use client";

import type { AnchorsData } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#EF4444", "#06B6D4", "#84CC16"];

interface Props {
  data: AnchorsData | null;
  isLoading: boolean;
}

export function AnchorTextChart({ data, isLoading }: Props) {
  const total = data?.items.reduce((sum, i) => sum + i.count, 0) ?? 0;

  return (
    <Card className="card-shadow h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Anchor Text</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-3 mt-1">
            {data.items.map((item, i) => (
              <div key={item.anchor}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-xs text-muted-foreground">{item.anchor}</span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums">{item.percentage}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: COLORS[i % COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground text-right pt-1 border-t mt-3">
              {total.toLocaleString()} total backlinks
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
