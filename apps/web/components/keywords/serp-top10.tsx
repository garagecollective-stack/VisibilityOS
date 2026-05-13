"use client";

import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface OrganicResult {
  position: number;
  domain: string;
  url: string;
  title: string;
  description: string;
}

interface Props {
  results: OrganicResult[];
  loading?: boolean;
}

export function SerpTop10({ results, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Top Ranking Pages</CardTitle>
          <p className="text-sm text-muted-foreground">
            Current top 10 results for this keyword
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Top Ranking Pages</CardTitle>
        <p className="text-sm text-muted-foreground">
          Current top {results.length} results for this keyword
        </p>
      </CardHeader>
      <CardContent className="divide-y">
        {results.map((result) => (
          <ResultRow key={`${result.position}-${result.url}`} result={result} />
        ))}
      </CardContent>
    </Card>
  );
}

function ResultRow({ result }: { result: OrganicResult }) {
  return (
    <div className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <PositionBadge position={result.position} />
      <div className="min-w-0 flex-1 space-y-1">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2 text-sm"
        >
          <img
            src={`https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(result.domain)}`}
            alt=""
            width={16}
            height={16}
            className="h-4 w-4 shrink-0 rounded-sm"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
          <span className="font-semibold text-foreground group-hover:text-primary">
            {result.domain}
          </span>
          <span className="truncate text-xs text-muted-foreground group-hover:underline">
            {prettyUrl(result.url)}
          </span>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </a>
        <TitleWithTooltip title={result.title} />
        {result.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {truncate(result.description, 200)}
          </p>
        )}
      </div>
    </div>
  );
}

function TitleWithTooltip({ title }: { title: string }) {
  const truncated = title.length > 60;
  if (!truncated) {
    return <p className="text-sm text-primary">{title}</p>;
  }
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="cursor-help text-sm text-primary">
            {title.slice(0, 60)}…
          </p>
        </TooltipTrigger>
        <TooltipContent className="max-w-md">{title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PositionBadge({ position }: { position: number }) {
  const cls =
    position === 1
      ? "bg-yellow-100 text-yellow-800 ring-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:ring-yellow-900"
      : position === 2
      ? "bg-slate-200 text-slate-800 ring-slate-300 dark:bg-slate-700/50 dark:text-slate-200 dark:ring-slate-600"
      : position === 3
      ? "bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-900"
      : "bg-muted text-muted-foreground ring-border";
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ring-1",
        cls
      )}
    >
      {position}
    </span>
  );
}

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 1 ? u.pathname : "";
    return path || "/";
  } catch {
    return url;
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}
