"use client";

import { CheckCircle2, ExternalLink, Globe2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { formatMetric } from "@/lib/keywords";
import { cn } from "@/lib/utils";

interface Props {
  connected: boolean;
}

const SAMPLE_TOP_PAGES = [
  { path: "/blog/best-keyword-research-tools", clicks: 1842, impressions: 28100 },
  { path: "/pricing", clicks: 1207, impressions: 14600 },
  { path: "/blog/site-audit-checklist", clicks: 940, impressions: 11200 },
];

export function GscConnectionCard({ connected }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Search Console</CardTitle>
        </div>
        {connected && <SampleDataBadge />}
      </CardHeader>
      <CardContent>
        {!connected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect Google Search Console to see clicks, impressions, and top performing pages.
            </p>
            <Button className="w-full" variant="default">
              <ExternalLink className="mr-2 h-4 w-4" />
              Connect Google Search Console
            </Button>
            <ul className="space-y-1.5 pt-1 text-xs text-muted-foreground">
              <li>• Pull last 16 months of search performance</li>
              <li>• Sync impressions, CTR, and average position</li>
              <li>• Discover keywords you don't track yet</li>
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Connected · last synced 2 hours ago</span>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Top performing pages (28d)
              </p>
              <div className="space-y-2">
                {SAMPLE_TOP_PAGES.map((page) => (
                  <div
                    key={page.path}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                    )}
                  >
                    <span className="truncate text-xs font-medium">{page.path}</span>
                    <div className="flex shrink-0 gap-3 text-right text-xs tabular-nums">
                      <span>
                        <span className="text-muted-foreground">Clicks </span>
                        <span className="font-semibold">{formatMetric(page.clicks)}</span>
                      </span>
                      <span>
                        <span className="text-muted-foreground">Impr. </span>
                        <span className="font-semibold">{formatMetric(page.impressions)}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
