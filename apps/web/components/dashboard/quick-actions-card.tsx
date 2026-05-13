"use client";

import Link from "next/link";
import { ListChecks, Search, ShieldCheck, TrendingUp, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ACTIONS = [
  {
    href: "/dashboard/audit",
    label: "Run Audit",
    icon: ShieldCheck,
    iconCls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  {
    href: "/dashboard/keywords/lists",
    label: "Add Keywords",
    icon: ListChecks,
    iconCls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  {
    href: "/dashboard/rank-tracker",
    label: "Check Rankings",
    icon: TrendingUp,
    iconCls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  {
    href: "/dashboard/keywords/overview",
    label: "Research Keyword",
    icon: Search,
    iconCls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
] as const;

interface Props {
  hasAudit?: boolean;
  hasKeywords?: boolean;
  lastBacklinkCheck?: string | null;
}

export function QuickActionsCard({ hasAudit = true, hasKeywords = true, lastBacklinkCheck }: Props) {
  // Determine the href of the single most important action to highlight
  let priorityHref: string | null = null;
  if (!hasAudit) priorityHref = "/dashboard/audit";
  else if (!hasKeywords) priorityHref = "/dashboard/keywords/lists";
  else if (
    lastBacklinkCheck &&
    Date.now() - new Date(lastBacklinkCheck).getTime() > 30 * 24 * 60 * 60 * 1000
  ) {
    priorityHref = "/dashboard/rank-tracker";
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const isPriority = priorityHref === action.href;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                "group flex items-center gap-2.5 rounded-md border bg-background p-3 text-sm transition-colors hover:border-primary/40 hover:bg-accent",
                isPriority && "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                  action.iconCls
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex flex-col">
                <span className="font-medium">{action.label}</span>
                {isPriority && (
                  <span className="text-[10px] text-primary">Recommended</span>
                )}
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
