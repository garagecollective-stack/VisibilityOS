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

const GROUP_ORDER: AlertKind[] = ["rank_drop", "audit", "new_keyword"];

const GROUP_LABELS: Record<AlertKind, string> = {
  rank_drop: "Ranking",
  audit: "Audit",
  new_keyword: "Keywords",
};

export function RecentAlerts() {
  const grouped = GROUP_ORDER.map((kind) => ({
    kind,
    label: GROUP_LABELS[kind],
    meta: ICONS[kind],
    alerts: SAMPLE_ALERTS.filter((a) => a.kind === kind),
  })).filter((g) => g.alerts.length > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Recent Alerts</CardTitle>
        </div>
        <SampleDataBadge />
      </CardHeader>
      <CardContent className="space-y-4">
        {grouped.map((group) => (
          <div key={group.kind}>
            <div className={cn("mb-2 flex items-center gap-1.5 rounded px-2 py-0.5 w-fit text-xs font-semibold", group.meta.cls)}>
              {group.meta.icon}
              <span>{group.label}</span>
            </div>
            <div className="space-y-2 pl-1">
              {group.alerts.map((alert, i) => (
                <div key={i} className="flex gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{alert.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{alert.detail}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{alert.time}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
