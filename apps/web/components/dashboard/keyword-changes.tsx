"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";

interface Props {
  newKeywords: number;
  lostKeywords: number;
  isSample?: boolean;
}

export function KeywordChangesCard({ newKeywords, lostKeywords, isSample = false }: Props) {
  const displayNew = isSample ? 14 : newKeywords;
  const displayLost = isSample ? 6 : lostKeywords;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="text-base">Keyword Changes 7d</CardTitle>
        {isSample && <SampleDataBadge />}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center justify-center rounded-lg border bg-green-50 py-4 dark:bg-green-950/20">
            <TrendingUp className="mb-1.5 h-5 w-5 text-green-600 dark:text-green-400" />
            <p className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-400">
              +{displayNew}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">New</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-lg border bg-red-50 py-4 dark:bg-red-950/20">
            <TrendingDown className="mb-1.5 h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-2xl font-bold tabular-nums text-red-700 dark:text-red-400">
              -{displayLost}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Lost</p>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Keywords appearing or disappearing from top 100 in the last 7 days
        </p>
      </CardContent>
    </Card>
  );
}
