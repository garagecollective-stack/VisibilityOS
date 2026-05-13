"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { formatMetric } from "@/lib/keywords";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
}

const SAMPLE_MOVERS = [
  { keyword: "best seo tools india", current: 3, change: 6, volume: 4400 },
  { keyword: "rank tracker for agencies", current: 8, change: 4, volume: 1900 },
  { keyword: "seo audit checklist 2026", current: 12, change: 2, volume: 2700 },
  { keyword: "keyword research tutorial", current: 21, change: -5, volume: 5100 },
  { keyword: "competitor analysis tools", current: 28, change: -9, volume: 3300 },
];

export function TopMoversTable({ projectId }: Props) {
  void projectId;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Top Keyword Movers (7d)</CardTitle>
        </div>
        <SampleDataBadge />
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>Keyword</TableHead>
              <TableHead className="text-right">Position</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="text-right">Volume</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_MOVERS.map((row) => (
              <TableRow key={row.keyword}>
                <TableCell className="max-w-[220px] truncate font-medium">{row.keyword}</TableCell>
                <TableCell className="text-right tabular-nums">{row.current}</TableCell>
                <TableCell
                  className={cn(
                    "text-right text-xs font-semibold tabular-nums",
                    row.change > 0 && "text-green-600 dark:text-green-400",
                    row.change < 0 && "text-red-600 dark:text-red-400",
                    row.change === 0 && "text-muted-foreground"
                  )}
                >
                  <span className="inline-flex items-center gap-0.5 justify-end">
                    {row.change > 0 && <ArrowUpRight className="h-3.5 w-3.5" />}
                    {row.change < 0 && <ArrowDownRight className="h-3.5 w-3.5" />}
                    {row.change > 0 ? "+" : ""}
                    {row.change}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatMetric(row.volume)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="border-t p-3 text-right">
          <Link
            href="/dashboard/rank-tracker"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View full rank tracker
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
