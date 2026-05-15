"use client";

import { ExternalLink } from "lucide-react";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMetric } from "@/lib/keywords";
import { cn } from "@/lib/utils";

interface TopPage {
  url: string;
  traffic: number;
  keywords: number;
  topKeyword: string;
  topPosition: number;
}

interface Props {
  pages: TopPage[];
  loading: boolean;
  isMock: boolean;
  competitorDomain: string;
}

function PositionBadge({ pos }: { pos: number }) {
  const color =
    pos <= 3
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : pos <= 10
        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        : pos <= 20
          ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tabular-nums", color)}>
      #{pos}
    </span>
  );
}

function truncateUrl(url: string, max = 50): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const path = u.pathname;
    return path.length > max ? path.substring(0, max) + "…" : path;
  } catch {
    return url.length > max ? url.substring(0, max) + "…" : url;
  }
}

export function TopPagesTable({ pages, loading, isMock, competitorDomain }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="font-medium">Unable to fetch pages data</p>
        <p className="text-sm text-muted-foreground mt-1">
          Top pages data is unavailable for this competitor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isMock && <SampleDataBadge />}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-8">#</TableHead>
              <TableHead>Page URL</TableHead>
              <TableHead className="text-right">Est. Traffic</TableHead>
              <TableHead className="text-right">Keywords</TableHead>
              <TableHead>Top Keyword</TableHead>
              <TableHead className="text-right">Top Pos</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.map((page, i) => (
              <TableRow key={page.url}>
                <TableCell className="text-muted-foreground text-sm font-medium">{i + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${competitorDomain}&sz=16`}
                      alt=""
                      className="h-4 w-4 rounded-sm shrink-0"
                    />
                    <span className="text-sm font-medium truncate" title={page.url}>
                      {truncateUrl(page.url)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {formatMetric(page.traffic)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {formatMetric(page.keywords)}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground truncate max-w-[180px] block" title={page.topKeyword}>
                    {page.topKeyword}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <PositionBadge pos={page.topPosition} />
                </TableCell>
                <TableCell>
                  <a
                    href={page.url.startsWith("http") ? page.url : `https://${page.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
