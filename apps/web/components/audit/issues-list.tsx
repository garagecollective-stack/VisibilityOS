"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Severity = "critical" | "warning" | "notice";
type Category =
  | "meta"
  | "links"
  | "speed"
  | "content"
  | "schema"
  | "mobile"
  | "security"
  | "indexing"
  | "cwv"
  | "ai_search";

export interface IssueRow {
  id: string;
  severity: Severity;
  category: Category;
  url: string | null;
  affectedUrls: string[];
  title: string;
  description: string;
  recommendation: string;
  affectedCount: number;
}

const SEVERITY_TABS: Array<{ value: "all" | Severity; label: string }> = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warnings" },
  { value: "notice", label: "Notices" },
];

const CATEGORY_LABELS: Record<Category, string> = {
  meta: "Meta",
  links: "Links",
  speed: "Speed",
  content: "Content",
  schema: "Schema",
  mobile: "Mobile",
  security: "Security",
  indexing: "Indexing",
  cwv: "Core Web Vitals",
  ai_search: "AI Search",
};

export function IssuesList({ issues }: { issues: IssueRow[] }) {
  const [severityTab, setSeverityTab] = useState<"all" | Severity>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | Category>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const severityCounts = useMemo(() => {
    const counts: Record<"all" | Severity, number> = {
      all: issues.length,
      critical: 0,
      warning: 0,
      notice: 0,
    };
    for (const issue of issues) counts[issue.severity]++;
    return counts;
  }, [issues]);

  const visibleIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (severityTab !== "all" && issue.severity !== severityTab) return false;
      if (categoryFilter !== "all" && issue.category !== categoryFilter) return false;
      return true;
    });
  }, [issues, severityTab, categoryFilter]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold">Issues</h3>
          <div className="print:hidden min-w-[180px]">
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value as "all" | Category)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={severityTab} onValueChange={(v) => setSeverityTab(v as "all" | Severity)}>
          <TabsList className="print:hidden grid grid-cols-4 sm:inline-flex sm:w-auto">
            {SEVERITY_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                {tab.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    tab.value === "critical" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                    tab.value === "warning" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                    tab.value === "notice" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                    tab.value === "all" && "bg-muted text-muted-foreground"
                  )}
                >
                  {severityCounts[tab.value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {visibleIssues.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="font-medium">No issues in this view</p>
            <p className="text-sm text-muted-foreground">
              {severityTab === "all"
                ? "Your site looks great!"
                : `No ${SEVERITY_TABS.find((t) => t.value === severityTab)?.label.toLowerCase()} issues found.`}
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {visibleIssues.map((issue) => (
              <IssueItem
                key={issue.id}
                issue={issue}
                expanded={expanded.has(issue.id)}
                onToggle={() => toggle(issue.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IssueItem({
  issue,
  expanded,
  onToggle,
}: {
  issue: IssueRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
        aria-expanded={expanded}
      >
        <SeverityIcon severity={issue.severity} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{issue.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{issue.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CategoryBadge category={issue.category} />
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
            {issue.affectedCount} {issue.affectedCount === 1 ? "page" : "pages"}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t bg-muted/20 px-4 py-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Affected URLs
            </p>
            {issue.affectedUrls.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">
                No specific URL — site-wide issue
              </p>
            ) : (
              <ul className="space-y-1">
                {issue.affectedUrls.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 break-all text-xs text-primary hover:underline"
                    >
                      <span>{url}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {issue.recommendation && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                How to fix
              </p>
              <p className="text-sm text-foreground">{issue.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === "critical") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
        <XCircle className="h-4 w-4" />
      </span>
    );
  }
  if (severity === "warning") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400">
        <AlertTriangle className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
      <Info className="h-4 w-4" />
    </span>
  );
}

function CategoryBadge({ category }: { category: Category }) {
  return (
    <span className="rounded-md border bg-background px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {CATEGORY_LABELS[category]}
    </span>
  );
}
