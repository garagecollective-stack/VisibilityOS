"use client";

import { AlertTriangle, Bell, Search, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { cn } from "@/lib/utils";

type AlertKind = "rank_drop" | "audit" | "new_keyword";

interface AlertItem {
  kind: AlertKind;
  title: string;
  detail: string;
  time: string;
}

const SAMPLE_ALERTS: AlertItem[] = [
  {
    kind: "rank_drop",
    title: "Rank dropped 6 positions",
    detail: "“competitor analysis tools” fell from #19 to #25",
    time: "2h ago",
  },
  {
    kind: "audit",
    title: "Audit found 12 critical issues",
    detail: "Missing meta descriptions on category pages",
    time: "Yesterday",
  },
  {
    kind: "new_keyword",
    title: "23 new keyword opportunities",
    detail: "Discovered while crawling /blog/* pages",
    time: "2 days ago",
  },
  {
    kind: "rank_drop",
    title: "Visibility down 3.2 points",
    detail: "Recovery expected next refresh",
    time: "3 days ago",
  },
];

const ICONS: Record<AlertKind, { icon: React.ReactNode; cls: string }> = {
  rank_drop: { icon: <TrendingDown className="h-4 w-4" />, cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  audit: { icon: <AlertTriangle className="h-4 w-4" />, cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  new_keyword: { icon: <Search className="h-4 w-4" />, cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

export function RecentAlerts() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Recent Alerts</CardTitle>
        </div>
        <SampleDataBadge />
      </CardHeader>
      <CardContent className="space-y-3">
        {SAMPLE_ALERTS.map((alert, i) => {
          const meta = ICONS[alert.kind];
          return (
            <div key={i} className="flex gap-3">
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", meta.cls)}>
                {meta.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{alert.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{alert.detail}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{alert.time}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
