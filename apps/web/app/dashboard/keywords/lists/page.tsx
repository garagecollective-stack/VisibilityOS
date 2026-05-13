"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Download,
  List,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { IntentBadge } from "@/components/keywords/intent-badge";
import { KdBadge } from "@/components/keywords/kd-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import { downloadCsv } from "@/lib/export-csv";
import {
  formatMetric,
  type KeywordListItem,
  type KeywordListRecord,
  type KeywordListsResult,
  type ProjectSummary,
} from "@/lib/keywords";
import { cn } from "@/lib/utils";

type IntentFilter = "all" | "Informational" | "Commercial" | "Transactional" | "Navigational";

function avgNum(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function KeywordListsPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [listSearch, setListSearch] = useState("");

  // Item filters
  const [intentFilter, setIntentFilter] = useState<IntentFilter>("all");
  const [kdMin, setKdMin] = useState("");
  const [kdMax, setKdMax] = useState("");
  const [volMin, setVolMin] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createProjectId, setCreateProjectId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [rawKeywords, setRawKeywords] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState("");
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackProjectId, setTrackProjectId] = useState("");
  const [trackKeywords, setTrackKeywords] = useState<string[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ projects: ProjectSummary[] }>("/projects", {
        token: token ?? undefined,
      });
    },
  });

  const listsQuery = useQuery({
    queryKey: ["keyword-lists", selectedProject],
    queryFn: async () => {
      const token = await getToken();
      const suffix =
        selectedProject !== "all" ? `?projectId=${encodeURIComponent(selectedProject)}` : "";
      return apiClient<KeywordListsResult>(`/keywords/lists${suffix}`, {
        token: token ?? undefined,
      });
    },
  });

  const projects = projectsQuery.data?.projects ?? [];
  const allLists = listsQuery.data?.lists ?? [];
  const filteredLists = useMemo(() => {
    const term = listSearch.trim().toLowerCase();
    if (!term) return allLists;
    return allLists.filter((list) => list.name.toLowerCase().includes(term));
  }, [allLists, listSearch]);
  const selectedList = allLists.find((list) => list.id === selectedListId) ?? null;

  useEffect(() => {
    if (!createProjectId && projects.length) setCreateProjectId(projects[0]!.id);
    if (!trackProjectId && projects.length) setTrackProjectId(projects[0]!.id);
  }, [projects, createProjectId, trackProjectId]);

  useEffect(() => {
    if (!selectedListId && filteredLists.length) setSelectedListId(filteredLists[0]!.id);
  }, [filteredLists, selectedListId]);

  useEffect(() => {
    if (
      selectedListId &&
      allLists.length > 0 &&
      !allLists.some((list) => list.id === selectedListId)
    ) {
      setSelectedListId(filteredLists[0]?.id ?? "");
    }
  }, [allLists, filteredLists, selectedListId]);

  // Note: trackProjectId default is set when the Track dialog opens (see
  // openTrackAll below). Auto-syncing it via effect fought the lists refetch
  // and reverted the user's manual choice on every mutation.

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return apiClient("/keywords/lists", {
        method: "POST",
        body: JSON.stringify({ name: createName.trim(), projectId: createProjectId || undefined }),
        token: token ?? undefined,
      });
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setCreateName("");
      await queryClient.invalidateQueries({ queryKey: ["keyword-lists"] });
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const token = await getToken();
      return apiClient(`/keywords/lists/${listId}`, {
        method: "DELETE",
        token: token ?? undefined,
      });
    },
    onSuccess: async (_, listId) => {
      if (selectedListId === listId) setSelectedListId("");
      await queryClient.invalidateQueries({ queryKey: ["keyword-lists"] });
    },
  });

  const addKeywordsMutation = useMutation({
    mutationFn: async (keywords: string[]) => {
      const token = await getToken();
      return apiClient(`/keywords/lists/${selectedListId}/keywords`, {
        method: "POST",
        body: JSON.stringify({ keywords }),
        token: token ?? undefined,
      });
    },
    onSuccess: async () => {
      setAddOpen(false);
      setRawKeywords("");
      await queryClient.invalidateQueries({ queryKey: ["keyword-lists"] });
    },
  });

  const enrichMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!selectedList) throw new Error("No list selected");
      return apiClient<{ enriched: number; failed: number }>(
        `/keywords/projects/${selectedList.projectId}/lists/${selectedList.id}/enrich`,
        { method: "POST", body: JSON.stringify({}), token: token ?? undefined }
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["keyword-lists"] });
    },
  });

  const deleteItemsMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const token = await getToken();
      if (!selectedList) throw new Error("No list selected");
      await Promise.all(
        itemIds.map((itemId) =>
          apiClient(
            `/keywords/projects/${selectedList.projectId}/lists/${selectedList.id}/keywords/${itemId}`,
            { method: "DELETE", token: token ?? undefined }
          )
        )
      );
    },
    onSuccess: async () => {
      setSelected(new Set());
      setConfirmDeleteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["keyword-lists"] });
    },
  });

  const moveMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!selectedList) throw new Error("No list selected");
      const items = selectedList.items.filter((i) => selected.has(i.id));
      const keywordIds = items.map((i) => i.keywordId);
      return apiClient<{ moved: number }>(
        `/keywords/projects/${selectedList.projectId}/lists/${selectedList.id}/move`,
        {
          method: "POST",
          body: JSON.stringify({ keywordIds, targetListId: moveTargetId }),
          token: token ?? undefined,
        }
      );
    },
    onSuccess: async () => {
      setMoveOpen(false);
      setMoveTargetId("");
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["keyword-lists"] });
    },
  });

  const trackMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!selectedList || !trackProjectId) throw new Error("Missing input");
      // Use device + locationCode from the first item (consistent within a list)
      const firstItem = selectedList.items[0];
      const locationCode = firstItem ? Number(firstItem.keyword.locationCode || "2356") : 2356;
      const device = (firstItem?.keyword.device as "desktop" | "mobile") ?? "desktop";
      return apiClient<{ added: number; duplicates: number }>(
        `/keywords/projects/${trackProjectId}/tracked`,
        {
          method: "POST",
          body: JSON.stringify({
            keywords: trackKeywords,
            locationCode,
            languageCode: "en",
            device,
          }),
          token: token ?? undefined,
        }
      );
    },
    onSuccess: () => {
      setTrackOpen(false);
    },
  });

  // Item filtering
  const filteredItems = useMemo(() => {
    if (!selectedList) return [];
    const kdMinN = kdMin.trim() !== "" ? Number(kdMin) : null;
    const kdMaxN = kdMax.trim() !== "" ? Number(kdMax) : null;
    const volMinN = volMin.trim() !== "" ? Number(volMin) : null;
    return selectedList.items.filter((item) => {
      if (intentFilter !== "all" && item.intent !== intentFilter) return false;
      if (kdMinN !== null && (item.kd ?? -1) < kdMinN) return false;
      if (kdMaxN !== null && (item.kd ?? 101) > kdMaxN) return false;
      if (volMinN !== null && (item.volume ?? 0) < volMinN) return false;
      return true;
    });
  }, [selectedList, intentFilter, kdMin, kdMax, volMin]);

  const enriched = useMemo(
    () => (selectedList?.items ?? []).filter((i) => i.volume !== null || i.kd !== null).length,
    [selectedList]
  );
  const needsEnrichment =
    selectedList !== null && selectedList.items.length > 0 && enriched < selectedList.items.length;

  const exportSelected = (items: KeywordListItem[], filename: string) => {
    const header = ["Keyword", "Volume", "KD", "CPC", "Intent", "Location", "Language", "Device", "Added"];
    const rows = items.map((item) => [
      item.keyword.keyword,
      item.volume != null ? String(item.volume) : "",
      item.kd != null ? String(item.kd) : "",
      item.cpc != null ? item.cpc.toFixed(2) : "",
      item.intent ?? "",
      item.keyword.locationCode,
      item.keyword.languageCode,
      item.keyword.device,
      new Date(item.keyword.createdAt).toLocaleDateString(),
    ]);
    downloadCsv(filename, [header, ...rows]);
  };

  const openTrackAll = (keywords: string[]) => {
    setTrackKeywords(keywords);
    if (selectedList) setTrackProjectId(selectedList.projectId);
    setTrackOpen(true);
  };

  const moveTargetOptions = useMemo(
    () => allLists.filter((l) => l.projectId === selectedList?.projectId && l.id !== selectedListId),
    [allLists, selectedList, selectedListId]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Keyword Lists</h2>
          <p className="text-sm text-muted-foreground">
            Save strategic groups of keywords, enrich them with live SEO metrics, and push to the rank tracker.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="min-w-52">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New List
          </Button>
        </div>
      </div>

      {(projectsQuery.isLoading || listsQuery.isLoading) && <ListsSkeleton />}

      {(projectsQuery.isError || listsQuery.isError) && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          Failed to load keyword lists.
        </div>
      )}

      {!projectsQuery.isLoading && !listsQuery.isLoading && allLists.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <List className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <h3 className="font-medium">No keyword lists yet</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Create a list to group keywords by funnel stage, content cluster, or campaign theme.
            </p>
          </CardContent>
        </Card>
      )}

      {!projectsQuery.isLoading && !listsQuery.isLoading && allLists.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* Left: list cards */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                placeholder="Search lists…"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
              />
            </div>
            {filteredLists.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-6 text-center text-xs text-muted-foreground">
                  No lists match "{listSearch}"
                </CardContent>
              </Card>
            ) : (
              filteredLists.map((list) => {
                const avgKd = avgNum(list.items.map((i) => i.kd));
                const avgVol = avgNum(list.items.map((i) => i.volume));
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => {
                      setSelectedListId(list.id);
                      setSelected(new Set());
                    }}
                    className="w-full text-left"
                  >
                    <Card
                      className={cn(
                        selectedListId === list.id ? "border-orange-500 shadow-sm" : "hover:border-border/80"
                      )}
                    >
                      <CardContent className="space-y-2 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold">{list.name}</h3>
                            <p className="truncate text-xs text-muted-foreground">{list.projectName}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                            {list.items.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <span>Avg KD</span>
                            {avgKd !== null ? (
                              <KdBadge value={Math.round(avgKd)} className="ml-0.5" />
                            ) : (
                              <span className="text-muted-foreground/70">—</span>
                            )}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span>Avg Vol</span>
                            <span className="font-medium text-foreground">
                              {avgVol !== null ? formatMetric(Math.round(avgVol)) : "—"}
                            </span>
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Last updated {relativeTime(list.lastEnrichedAt ?? list.createdAt)}
                        </p>
                      </CardContent>
                    </Card>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: list detail */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{selectedList?.name ?? "Select a list"}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedList
                    ? `${selectedList.projectName} · ${selectedList.projectDomain}`
                    : "Choose a list from the left to inspect its keywords."}
                </p>
                {selectedList && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedList.lastEnrichedAt ? (
                      <>Last enriched {relativeTime(selectedList.lastEnrichedAt)}</>
                    ) : (
                      <>Not enriched yet</>
                    )}
                  </p>
                )}
              </div>
              {selectedList && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => enrichMutation.mutate()}
                    disabled={enrichMutation.isPending || selectedList.items.length === 0}
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    {enrichMutation.isPending
                      ? "Enriching…"
                      : needsEnrichment
                      ? "Enrich List"
                      : "Re-enrich"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openTrackAll(selectedList.items.map((i) => i.keyword.keyword))
                    }
                    disabled={selectedList.items.length === 0}
                  >
                    <Target className="mr-1.5 h-3.5 w-3.5" />
                    Track All
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add Keywords
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportSelected(selectedList.items, `${selectedList.name}.csv`)
                    }
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteListMutation.mutate(selectedList.id)}
                    disabled={deleteListMutation.isPending}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!selectedList ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Select a keyword list to inspect and manage its contents.
                </div>
              ) : selectedList.items.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  This list is empty. Add keywords to start building it out.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Filter bar */}
                  <div className="grid gap-2 sm:grid-cols-[180px_140px_120px]">
                    <Select
                      value={intentFilter}
                      onValueChange={(v) => setIntentFilter(v as IntentFilter)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All intents" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All intents</SelectItem>
                        <SelectItem value="Informational">Informational</SelectItem>
                        <SelectItem value="Commercial">Commercial</SelectItem>
                        <SelectItem value="Transactional">Transactional</SelectItem>
                        <SelectItem value="Navigational">Navigational</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        placeholder="KD min"
                        value={kdMin}
                        onChange={(e) => setKdMin(e.target.value)}
                        className="h-9"
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input
                        type="number"
                        placeholder="max"
                        value={kdMax}
                        onChange={(e) => setKdMax(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <Input
                      type="number"
                      placeholder="Min volume"
                      value={volMin}
                      onChange={(e) => setVolMin(e.target.value)}
                      className="h-9"
                    />
                  </div>

                  <ListItemsTable
                    items={filteredItems}
                    selected={selected}
                    onToggleRow={(id) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      });
                    }}
                    onToggleAll={(ids, allChecked) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (allChecked) ids.forEach((id) => next.delete(id));
                        else ids.forEach((id) => next.add(id));
                        return next;
                      });
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sticky bulk action bar */}
      {selectedList && selected.size > 0 && (
        <div className="sticky bottom-4 z-10">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-lg border bg-popover/95 px-4 py-3 shadow-lg backdrop-blur">
            <span className="text-sm font-medium">
              {selected.size} keyword{selected.size === 1 ? "" : "s"} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const items = selectedList.items.filter((i) => selected.has(i.id));
                  openTrackAll(items.map((i) => i.keyword.keyword));
                }}
              >
                <Target className="mr-1.5 h-3.5 w-3.5" />
                Track
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMoveOpen(true)}
                disabled={moveTargetOptions.length === 0}
              >
                <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                Move to List
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const items = selectedList.items.filter((i) => selected.has(i.id));
                  exportSelected(items, `${selectedList.name}-selected.csv`);
                }}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
                className="text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create list dialog ─── */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          createMutation.reset();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Keyword List</DialogTitle>
          </DialogHeader>
          {projects.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No projects found. Create a project from the dashboard before creating keyword lists.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="list-name">List name</Label>
                <Input
                  id="list-name"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="SEO quick wins"
                />
              </div>
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={createProjectId} onValueChange={setCreateProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {createMutation.isError && (
            <p className="text-sm text-destructive">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Failed to create list."}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                !createName.trim() ||
                !createProjectId ||
                createMutation.isPending ||
                projects.length === 0
              }
            >
              {createMutation.isPending ? "Creating..." : "Create List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add keywords dialog ─── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Keywords</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="keywords-to-add">Keywords</Label>
            <Textarea
              id="keywords-to-add"
              value={rawKeywords}
              onChange={(event) => setRawKeywords(event.target.value)}
              placeholder="One keyword per line"
              className="min-h-48"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                addKeywordsMutation.mutate(
                  rawKeywords
                    .split(/\r?\n/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
              disabled={!rawKeywords.trim() || addKeywordsMutation.isPending || !selectedList}
            >
              {addKeywordsMutation.isPending ? "Adding..." : "Add Keywords"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Move to list dialog ─── */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Move to another list</DialogTitle>
          </DialogHeader>
          {moveTargetOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other lists in this project.</p>
          ) : (
            <div className="space-y-2">
              <Label>Destination list</Label>
              <Select value={moveTargetId} onValueChange={setMoveTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a list" />
                </SelectTrigger>
                <SelectContent>
                  {moveTargetOptions.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name} ({list.items.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selected.size} keyword{selected.size === 1 ? "" : "s"} will move.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => moveMutation.mutate()}
              disabled={!moveTargetId || moveMutation.isPending}
            >
              {moveMutation.isPending ? "Moving…" : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Track all dialog ─── */}
      <Dialog open={trackOpen} onOpenChange={setTrackOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add keywords to rank tracker</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Adds <span className="font-semibold text-foreground">{trackKeywords.length}</span>{" "}
              keyword{trackKeywords.length === 1 ? "" : "s"} to the rank tracker. Duplicates against
              the selected project are skipped automatically.
            </p>
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={trackProjectId} onValueChange={setTrackProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {trackMutation.isError && (
            <p className="text-sm text-destructive">
              {trackMutation.error instanceof Error
                ? trackMutation.error.message
                : "Failed to add to rank tracker."}
            </p>
          )}
          {trackMutation.isSuccess && trackMutation.data && (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-400">
              Added {trackMutation.data.added} · {trackMutation.data.duplicates} duplicate
              {trackMutation.data.duplicates === 1 ? "" : "s"} skipped
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => trackMutation.mutate()}
              disabled={!trackProjectId || trackKeywords.length === 0 || trackMutation.isPending}
            >
              {trackMutation.isPending ? "Adding…" : `Add to Rank Tracker`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Confirm delete items ─── */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove keywords from list</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove {selected.size} keyword{selected.size === 1 ? "" : "s"} from "
            {selectedList?.name}"? They'll still exist in the rank tracker — only the list entry is
            removed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteItemsMutation.mutate(Array.from(selected))}
              disabled={deleteItemsMutation.isPending}
            >
              {deleteItemsMutation.isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Items table ──────────────────────────────────────────────────────────────

function ListItemsTable({
  items,
  selected,
  onToggleRow,
  onToggleAll,
}: {
  items: KeywordListItem[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: (ids: string[], allChecked: boolean) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<KeywordListItem>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => {
          const ids = table.getRowModel().rows.map((r) => r.original.id);
          const allChecked = ids.length > 0 && ids.every((id) => selected.has(id));
          return (
            <input
              type="checkbox"
              aria-label="Select all"
              className="h-4 w-4 cursor-pointer accent-orange-500"
              checked={allChecked}
              onChange={() => onToggleAll(ids, allChecked)}
            />
          );
        },
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.keyword.keyword}`}
            className="h-4 w-4 cursor-pointer accent-orange-500"
            checked={selected.has(row.original.id)}
            onChange={() => onToggleRow(row.original.id)}
          />
        ),
        enableSorting: false,
      },
      {
        id: "keyword",
        accessorFn: (row) => row.keyword.keyword,
        header: "Keyword",
        cell: ({ row }) => <span className="font-medium">{row.original.keyword.keyword}</span>,
      },
      {
        accessorKey: "volume",
        header: "Volume",
        cell: ({ getValue }) => {
          const v = getValue<number | null>();
          return v == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="tabular-nums">{formatMetric(v)}</span>
          );
        },
        sortingFn: (a, b) => (a.original.volume ?? -1) - (b.original.volume ?? -1),
      },
      {
        accessorKey: "kd",
        header: "KD",
        cell: ({ getValue }) => <KdBadge value={getValue<number | null>()} />,
        sortingFn: (a, b) => (a.original.kd ?? -1) - (b.original.kd ?? -1),
      },
      {
        accessorKey: "cpc",
        header: "CPC",
        cell: ({ getValue }) => {
          const v = getValue<number | null>();
          return v == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="tabular-nums">${v.toFixed(2)}</span>
          );
        },
      },
      {
        accessorKey: "intent",
        header: "Intent",
        cell: ({ getValue }) => {
          const intent = getValue<string | null>();
          return intent ? <IntentBadge intent={intent} /> : <span className="text-muted-foreground">—</span>;
        },
        enableSorting: false,
      },
      {
        id: "location",
        accessorFn: (row) => row.keyword.locationCode,
        header: "Location",
        cell: ({ row }) => row.original.keyword.locationCode,
        enableSorting: false,
      },
      {
        id: "device",
        accessorFn: (row) => row.keyword.device,
        header: "Device",
        cell: ({ row }) => <span className="capitalize">{row.original.keyword.device}</span>,
        enableSorting: false,
      },
      {
        id: "added",
        accessorFn: (row) => row.keyword.createdAt,
        header: "Added",
        cell: ({ row }) =>
          new Date(row.original.keyword.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
      },
    ],
    [selected, onToggleRow, onToggleAll]
  );

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No rows match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/30 hover:bg-muted/30">
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sort = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    className={cn(canSort && "cursor-pointer select-none")}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort &&
                        (sort === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : sort === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        ))}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} data-state={selected.has(row.original.id) ? "selected" : undefined}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ListsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-[420px] w-full" />
    </div>
  );
}
