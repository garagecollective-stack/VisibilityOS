"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { IntentBadge } from "@/components/keywords/intent-badge";
import { KdBadge } from "@/components/keywords/kd-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/lib/api";
import { formatMetric, type KeywordBulkRow, type KeywordStrategyResult } from "@/lib/keywords";

export default function KeywordStrategyPage() {
  const { getToken } = useAuth();
  const [topic, setTopic] = useState("");
  const [url, setUrl] = useState("");

  const strategyMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return apiClient<KeywordStrategyResult>("/keywords/strategy", {
        method: "POST",
        body: JSON.stringify({ topic: topic.trim(), url: url.trim() || undefined }),
        token: token ?? undefined,
      });
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Keyword Strategy Builder</h2>
        <p className="text-sm text-muted-foreground">
          Turn a topic or page URL into a pillar cluster, supporting terms, and quick-win opportunities.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="topic">Target topic or niche</Label>
            <Input
              id="topic"
              placeholder="CRM software for small business"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">Target URL (optional)</Label>
            <Input
              id="url"
              placeholder="https://example.com/crm"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>
          <Button onClick={() => strategyMutation.mutate()} disabled={!topic.trim() || strategyMutation.isPending}>
            {strategyMutation.isPending ? "Building..." : "Build Strategy"}
          </Button>
        </CardContent>
      </Card>

      {strategyMutation.isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {strategyMutation.error instanceof Error ? strategyMutation.error.message : "Strategy build failed."}
        </div>
      )}

      {!strategyMutation.data && !strategyMutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Enter a topic to map a pillar keyword cluster and identify low-difficulty quick wins.
          </CardContent>
        </Card>
      )}

      {strategyMutation.isPending && <StrategySkeleton />}

      {strategyMutation.data && !strategyMutation.isPending && (
        <div className="space-y-6">
          <KeywordSection
            title="Pillar Keywords"
            description="Head terms that should anchor the primary landing page and top-level content structure."
            rows={strategyMutation.data.pillarKeywords}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Supporting Keywords</CardTitle>
              <p className="text-sm text-muted-foreground">
                Long-tail opportunities grouped by subtopic so you can plan clusters and supporting content.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {strategyMutation.data.supportingKeywords.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No supporting keywords were generated for this topic.
                </div>
              ) : (
                strategyMutation.data.supportingKeywords.map((group) => (
                  <div key={group.subtopic} className="space-y-3">
                    <div>
                      <h3 className="font-medium">{group.subtopic}</h3>
                      <p className="text-sm text-muted-foreground">
                        Related long-tail opportunities in this subtopic cluster.
                      </p>
                    </div>
                    <KeywordTable rows={group.keywords} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50/40">
            <CardHeader>
              <CardTitle className="text-lg">Quick Wins</CardTitle>
              <p className="text-sm text-muted-foreground">
                Keywords with KD under 30 and monthly volume above 500.
              </p>
            </CardHeader>
            <CardContent>
              {strategyMutation.data.quickWins.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
                  No quick wins matched the current thresholds.
                </div>
              ) : (
                <KeywordTable rows={strategyMutation.data.quickWins} />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function KeywordSection({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: KeywordBulkRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No keywords were generated for this section.
          </div>
        ) : (
          <KeywordTable rows={rows} />
        )}
      </CardContent>
    </Card>
  );
}

function KeywordTable({ rows }: { rows: KeywordBulkRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead>Keyword</TableHead>
            <TableHead className="text-right">Volume</TableHead>
            <TableHead className="text-right">CPC</TableHead>
            <TableHead className="text-center">KD</TableHead>
            <TableHead>Intent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.keyword}>
              <TableCell className="font-medium">{row.keyword}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMetric(row.search_volume)}</TableCell>
              <TableCell className="text-right tabular-nums">${row.cpc.toFixed(2)}</TableCell>
              <TableCell className="text-center">
                <KdBadge value={row.keyword_difficulty} />
              </TableCell>
              <TableCell>
                <IntentBadge intent={row.intent} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StrategySkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <Card key={sectionIndex}>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-6 w-48" />
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <Skeleton key={rowIndex} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
