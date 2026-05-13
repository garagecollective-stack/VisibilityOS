"use client";

import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { formatMetric } from "@/lib/keywords";

interface Props {
  competitors: string[];
}

function sampleStats(seed: number) {
  const traffic = 8_000 + ((seed * 9301 + 49297) % 120_000);
  const keywords = 1_200 + ((seed * 233 + 17) % 6_500);
  return { traffic, keywords };
}

export function CompetitorSnapshot({ competitors }: Props) {
  const list = competitors.slice(0, 3);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Competitor Snapshot</CardTitle>
        </div>
        {list.length > 0 && <SampleDataBadge />}
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-8 text-center">
            <Users className="mb-2 h-7 w-7 text-muted-foreground/40" />
            <p className="text-sm font-medium">No competitors added yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Track up to 10 competitor domains to compare traffic and keyword coverage.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/dashboard/competitors">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Competitors
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((domain, index) => {
              const stats = sampleStats(domain.length + index);
              return (
                <div
                  key={domain}
                  className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{domain}</p>
                    <p className="text-xs text-muted-foreground">Sample estimate</p>
                  </div>
                  <div className="flex shrink-0 gap-4 text-right text-xs tabular-nums">
                    <div>
                      <p className="text-muted-foreground">Traffic</p>
                      <p className="font-semibold">{formatMetric(stats.traffic)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Keywords</p>
                      <p className="font-semibold">{formatMetric(stats.keywords)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <Button asChild variant="outline" size="sm" className="mt-2 w-full">
              <Link href="/dashboard/competitors">
                Manage Competitors
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
