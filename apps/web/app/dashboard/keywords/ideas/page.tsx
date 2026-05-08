"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "@tanstack/react-query";
import { Lightbulb, Search } from "lucide-react";
import { IntentBadge } from "@/components/keywords/intent-badge";
import { KdBadge } from "@/components/keywords/kd-badge";
import { Sparkline } from "@/components/keywords/sparkline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api";
import {
  formatMetric,
  KEYWORD_LOCATIONS,
  type KeywordIdeaResult,
  type KeywordRow,
} from "@/lib/keywords";

type IntentTab = "All" | "Informational" | "Commercial" | "Transactional" | "Navigational";

export default function KeywordIdeasPage() {
  const { getToken } = useAuth();
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("2356");
  const [intentTab, setIntentTab] = useState<IntentTab>("All");

  const ideasMutation = useMutation({
    mutationFn: async ({ seed, locationCode }: { seed: string; locationCode: string }) => {
      const token = await getToken();
      const query = new URLSearchParams({ keyword: seed, location: locationCode });
      return apiClient<KeywordIdeaResult>(`/keywords/ideas?${query.toString()}`, {
        method: "GET",
        token: token ?? undefined,
      });
    },
  });

  const filteredIdeas = useMemo(() => {
    const rows = ideasMutation.data?.ideas ?? [];
    if (intentTab === "All") return rows;
    return rows.filter((row) => row.intent === intentTab);
  }, [ideasMutation.data, intentTab]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!keyword.trim()) return;
    ideasMutation.mutate({ seed: keyword.trim(), locationCode: location });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Keyword Ideas</h2>
        <p className="text-sm text-muted-foreground">
          Generate adjacent keyword opportunities and review them by intent profile.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Seed keyword"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger>
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {KEYWORD_LOCATIONS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={!keyword.trim() || ideasMutation.isPending}>
          {ideasMutation.isPending ? "Generating..." : "Generate Ideas"}
        </Button>
      </form>

      {ideasMutation.isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {ideasMutation.error instanceof Error ? ideasMutation.error.message : "Failed to generate ideas."}
        </div>
      )}

      {!ideasMutation.data && !ideasMutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Lightbulb className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <h3 className="font-medium">Generate ideas from a seed keyword</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Use a starting query and market location to pull related terms, search intent, and trend signals.
            </p>
          </CardContent>
        </Card>
      )}

      {ideasMutation.isPending && <IdeasSkeleton />}

      {ideasMutation.data && !ideasMutation.isPending && (
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-lg">Generated Ideas</CardTitle>
              <Tabs value={intentTab} onValueChange={(value) => setIntentTab(value as IntentTab)}>
                <TabsList className="flex h-auto flex-wrap justify-start bg-transparent p-0">
                  {["All", "Informational", "Commercial", "Transactional", "Navigational"].map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="rounded-md border border-border bg-background data-[state=active]:border-orange-500 data-[state=active]:text-foreground"
                    >
                      {tab}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {filteredIdeas.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No ideas matched the selected intent bucket.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Keyword</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">CPC</TableHead>
                      <TableHead className="text-center">KD</TableHead>
                      <TableHead>Intent</TableHead>
                      <TableHead className="min-w-32">Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIdeas.map((row) => (
                      <IdeaRow key={row.keyword} row={row} />
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

function IdeaRow({ row }: { row: KeywordRow }) {
  return (
    <TableRow>
      <TableCell className="max-w-64 font-medium">{row.keyword}</TableCell>
      <TableCell className="text-right tabular-nums">{formatMetric(row.search_volume)}</TableCell>
      <TableCell className="text-right tabular-nums">${row.cpc.toFixed(2)}</TableCell>
      <TableCell className="text-center">
        <KdBadge value={row.keyword_difficulty} />
      </TableCell>
      <TableCell>
        <IntentBadge intent={row.intent} />
      </TableCell>
      <TableCell className="min-w-32">
        <Sparkline data={row.monthly_searches} height={32} />
      </TableCell>
    </TableRow>
  );
}

function IdeasSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <Skeleton className="h-8 w-64" />
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
