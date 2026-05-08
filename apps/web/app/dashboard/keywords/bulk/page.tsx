"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "@tanstack/react-query";
import { Download, FileUp, ListFilter } from "lucide-react";
import { IntentBadge } from "@/components/keywords/intent-badge";
import { KdBadge } from "@/components/keywords/kd-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import { downloadCsv, formatMetric, type KeywordBulkResult, type KeywordBulkRow } from "@/lib/keywords";
import { cn } from "@/lib/utils";

type SortKey = keyof KeywordBulkRow;
type SortDir = "asc" | "desc";

export default function KeywordBulkPage() {
  const { getToken } = useAuth();
  const [rawKeywords, setRawKeywords] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("search_volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const bulkMutation = useMutation({
    mutationFn: async (keywords: string[]) => {
      const token = await getToken();
      return apiClient<KeywordBulkResult>("/keywords/bulk", {
        method: "POST",
        body: JSON.stringify({ keywords }),
        token: token ?? undefined,
      });
    },
  });

  const keywords = useMemo(
    () =>
      rawKeywords
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 200),
    [rawKeywords]
  );

  const rows = useMemo(() => {
    const items = bulkMutation.data?.results ?? [];
    return [...items].sort((a, b) => {
      const av = a[sortKey] ?? -1;
      const bv = b[sortKey] ?? -1;
      const cmp = typeof av === "string" ? av.localeCompare(String(bv)) : Number(av) - Number(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [bulkMutation.data, sortDir, sortKey]);

  const onAnalyze = () => {
    if (keywords.length === 0) return;
    bulkMutation.mutate(keywords);
  };

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const normalized = text
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 200)
      .join("\n");
    setRawKeywords(normalized);
    event.target.value = "";
  };

  const onExport = () => {
    if (rows.length === 0) return;
    downloadCsv("keyword-bulk-analysis.csv", [
      ["Keyword", "Volume", "CPC", "KD", "Intent", "Competition"],
      ...rows.map((row) => [
        row.keyword,
        String(row.search_volume),
        row.cpc.toFixed(2),
        row.keyword_difficulty == null ? "" : String(row.keyword_difficulty),
        row.intent,
        row.competition == null ? "" : String(row.competition),
      ]),
    ]);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Keyword Bulk Analysis</h2>
        <p className="text-sm text-muted-foreground">
          Paste up to 200 keywords or upload a CSV to compare volume, CPC, intent, and competition.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <Textarea
            placeholder="Paste one keyword per line"
            className="min-h-52"
            value={rawKeywords}
            onChange={(event) => setRawKeywords(event.target.value)}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {keywords.length}/200 keywords ready for analysis
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <label className="cursor-pointer">
                  <FileUp className="mr-2 h-4 w-4" />
                  Upload CSV
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
                </label>
              </Button>
              <Button onClick={onAnalyze} disabled={keywords.length === 0 || bulkMutation.isPending}>
                {bulkMutation.isPending ? "Analyzing..." : "Analyze Keywords"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {bulkMutation.isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {bulkMutation.error instanceof Error ? bulkMutation.error.message : "Bulk analysis failed."}
        </div>
      )}

      {bulkMutation.isPending && <BulkSkeleton />}

      {!bulkMutation.data && !bulkMutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <ListFilter className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <h3 className="font-medium">Run a batch analysis</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Compare keyword opportunities at scale, then export the result set as CSV.
            </p>
          </CardContent>
        </Card>
      )}

      {bulkMutation.data && !bulkMutation.isPending && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-lg">Bulk Results</CardTitle>
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No keyword metrics were returned for this batch.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <SortableHead onClick={() => toggleSort("keyword")}>Keyword</SortableHead>
                      <SortableHead className="text-right" onClick={() => toggleSort("search_volume")}>
                        Volume
                      </SortableHead>
                      <SortableHead className="text-right" onClick={() => toggleSort("cpc")}>
                        CPC
                      </SortableHead>
                      <SortableHead className="text-center" onClick={() => toggleSort("keyword_difficulty")}>
                        KD
                      </SortableHead>
                      <SortableHead onClick={() => toggleSort("intent")}>Intent</SortableHead>
                      <SortableHead className="text-right" onClick={() => toggleSort("competition")}>
                        Competition
                      </SortableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.keyword}>
                        <TableCell className="font-medium">{row.keyword}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMetric(row.search_volume)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">${row.cpc.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <KdBadge value={row.keyword_difficulty} />
                        </TableCell>
                        <TableCell>
                          <IntentBadge intent={row.intent} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.competition == null ? "N/A" : row.competition.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SortableHead({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <TableHead className={cn("cursor-pointer hover:text-foreground", className)} onClick={onClick}>
      {children}
    </TableHead>
  );
}

function BulkSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
