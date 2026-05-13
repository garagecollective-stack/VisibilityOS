"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bookmark, Download, Layers, RotateCcw } from "lucide-react";
import { SaveToListDialog } from "@/components/keywords/save-to-list-dialog";
import { StrategyCalendar } from "@/components/keywords/strategy-calendar";
import { StrategyClusterCard } from "@/components/keywords/strategy-cluster-card";
import { StrategyLoading } from "@/components/keywords/strategy-loading";
import { StrategyPillarCard } from "@/components/keywords/strategy-pillar-card";
import { StrategySummary } from "@/components/keywords/strategy-summary";
import { CountrySelector } from "@/components/shared/country-selector";
import { DeviceToggle, type Device } from "@/components/shared/device-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api";
import { downloadCsv } from "@/lib/export-csv";
import type { KeywordStrategyResult, ProjectSummary } from "@/lib/keywords";
import { ssGet, ssParse, ssSet, ssStringify } from "@/lib/session-store";

interface StrategyInputs {
  topic: string;
  url: string;
  locationCode: number;
  device: Device;
}

export default function KeywordStrategyPage() {
  const { getToken } = useAuth();
  const [topic, setTopic] = useState("");
  const [url, setUrl] = useState("");
  const [location, setLocation] = useState<string>("2356");
  const [device, setDevice] = useState<Device>("desktop");

  const [results, setResults] = useState<KeywordStrategyResult | null>(null);
  const [resultsFor, setResultsFor] = useState("");

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [dialogKeywords, setDialogKeywords] = useState<string[]>([]);

  useEffect(() => {
    const t = ssGet("lastStrategyTopic");
    const u = ssGet("lastStrategyUrl");
    const storedLocation = ssGet("lastStrategyLocation");
    const storedDevice = ssGet("lastStrategyDevice");
    const data = ssParse<KeywordStrategyResult>("lastStrategyResults");
    if (storedLocation) setLocation(storedLocation);
    if (storedDevice === "desktop" || storedDevice === "mobile") setDevice(storedDevice);
    if (t && data) {
      setTopic(t);
      if (u) setUrl(u);
      setResults(data);
      setResultsFor(t);
    }
  }, []);

  const strategyMutation = useMutation({
    mutationFn: async (inputs: StrategyInputs) => {
      const token = await getToken();
      return apiClient<KeywordStrategyResult>("/keywords/strategy", {
        method: "POST",
        body: JSON.stringify({
          topic: inputs.topic,
          targetUrl: inputs.url || undefined,
          locationCode: inputs.locationCode,
          device: inputs.device,
        }),
        token: token ?? undefined,
      });
    },
    onSuccess: (data, inputs) => {
      setResults(data);
      setResultsFor(inputs.topic);
      ssSet("lastStrategyTopic", inputs.topic);
      ssSet("lastStrategyUrl", inputs.url);
      ssSet("lastStrategyLocation", String(inputs.locationCode));
      ssSet("lastStrategyDevice", inputs.device);
      ssStringify("lastStrategyResults", data);
    },
  });

  const isPending = strategyMutation.isPending;

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ projects: ProjectSummary[] }>("/projects", { token: token ?? undefined });
    },
  });
  const projects = projectsQuery.data?.projects ?? [];

  useEffect(() => {
    if (projects.length > 0 && selectedProjectId === null) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const trackedKwsQuery = useQuery({
    queryKey: ["tracked-keywords", selectedProjectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ keywords: Array<{ keyword: string }> }>(
        `/keywords/projects/${selectedProjectId}/tracked`,
        { token: token ?? undefined }
      );
    },
    enabled: !!selectedProjectId,
  });

  const trackedSet = useMemo(() => {
    const kws = trackedKwsQuery.data?.keywords ?? [];
    return new Set(kws.map((k) => k.keyword));
  }, [trackedKwsQuery.data]);

  const handleBuild = () => {
    if (!topic.trim()) return;
    setResults(null);
    strategyMutation.mutate({
      topic: topic.trim(),
      url: url.trim(),
      locationCode: Number(location),
      device,
    });
  };

  const handleRegenerate = () => {
    if (!resultsFor && !topic.trim()) return;
    setResults(null);
    strategyMutation.mutate({
      topic: resultsFor || topic.trim(),
      url: url.trim(),
      locationCode: Number(location),
      device,
    });
  };

  const quickWinKeywords = useMemo(() => {
    if (!results) return new Set<string>();
    const set = new Set<string>();
    for (const c of results.clusters) {
      for (const k of c.supporting_keywords) if (k.is_quick_win) set.add(k.keyword);
    }
    return set;
  }, [results]);

  const allKeywords = useMemo(() => {
    if (!results) return [] as string[];
    const set = new Set<string>();
    set.add(results.pillar.keyword);
    for (const c of results.clusters) {
      set.add(c.pillar_page.keyword);
      for (const k of c.supporting_keywords) set.add(k.keyword);
    }
    for (const item of results.content_calendar) set.add(item.keyword);
    return Array.from(set);
  }, [results]);

  const openSave = (keywords: string[]) => {
    setDialogKeywords(keywords);
    setSaveDialogOpen(true);
  };

  const handleExportCsv = () => {
    if (!results) return;
    const rows: string[][] = [["Keyword", "Cluster", "Content Type", "Volume", "KD"]];
    rows.push([
      results.pillar.keyword,
      "(Pillar)",
      "Pillar Keyword",
      String(results.pillar.volume),
      String(results.pillar.kd),
    ]);
    for (const c of results.clusters) {
      rows.push([
        c.pillar_page.keyword,
        c.topic,
        c.pillar_page.content_type,
        String(c.pillar_page.volume),
        String(c.pillar_page.kd),
      ]);
      for (const k of c.supporting_keywords) {
        rows.push([
          k.keyword,
          c.topic,
          "Supporting",
          String(k.volume),
          String(k.kd),
        ]);
      }
    }
    downloadCsv(`strategy-${resultsFor.replace(/\s+/g, "-")}.csv`, rows);
  };

  const showEmpty = results === null && !isPending && !strategyMutation.isError;
  const showResults = results !== null && !isPending;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Keyword Strategy Builder</h2>
        <p className="text-sm text-muted-foreground">
          Turn a topic into a Claude-generated keyword strategy: pillar, clusters, quick wins, and an 8-week content calendar.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
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
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CountrySelector value={location} onValueChange={setLocation} />
            <DeviceToggle value={device} onChange={setDevice} />
            <div className="ml-auto">
              <Button onClick={handleBuild} disabled={!topic.trim() || isPending}>
                <Layers className="mr-1.5 h-4 w-4" />
                {isPending ? "Building..." : "Build Strategy"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {strategyMutation.isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {strategyMutation.error instanceof Error
            ? strategyMutation.error.message
            : "Strategy build failed."}
        </div>
      )}

      {showEmpty && (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Enter a topic to map a pillar keyword cluster, supporting keywords, quick wins, and an 8-week content plan.
          </CardContent>
        </Card>
      )}

      {isPending && <StrategyLoading />}

      {showResults && results && (
        <div className="space-y-6">
          <p className="text-xs text-muted-foreground">
            Showing previous results for:{" "}
            <span className="font-medium text-foreground">{resultsFor}</span>
          </p>

          <StrategySummary strategy={results} />

          <StrategyPillarCard
            pillar={results.pillar}
            onSave={(kw) => openSave([kw])}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Content Clusters</h3>
                <p className="text-sm text-muted-foreground">
                  {results.clusters.length} clusters · expand any group to see its supporting keywords
                </p>
              </div>
              {projects.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Tracking vs.</span>
                  <Select value={selectedProjectId ?? ""} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="h-7 w-[160px] text-xs">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {results.clusters.map((cluster, i) => (
                <StrategyClusterCard
                  key={`${cluster.topic}-${i}`}
                  cluster={cluster}
                  defaultOpen
                  onSaveKeyword={(kw) => openSave([kw])}
                  onSaveCluster={(kws) => openSave(kws)}
                  trackedKeywords={trackedSet}
                />
              ))}
            </div>
          </div>

          <StrategyCalendar items={results.content_calendar} quickWinKeywords={quickWinKeywords} />
        </div>
      )}

      {/* Sticky actions bar — only when results exist */}
      {showResults && (
        <div className="sticky bottom-4 z-10">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-lg border bg-popover/95 px-4 py-3 shadow-lg backdrop-blur">
            <span className="text-sm font-medium">
              {allKeywords.length} keyword{allKeywords.length === 1 ? "" : "s"} in this strategy
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={isPending}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Regenerate
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportCsv}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export Strategy CSV
              </Button>
              <Button size="sm" onClick={() => openSave(allKeywords)}>
                <Bookmark className="mr-1.5 h-3.5 w-3.5" />
                Save All to List
              </Button>
            </div>
          </div>
        </div>
      )}

      <SaveToListDialog
        keywords={dialogKeywords}
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
      />
    </div>
  );
}
