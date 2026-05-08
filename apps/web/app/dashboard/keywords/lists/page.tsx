"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, List, Plus, Trash2 } from "lucide-react";
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
import { downloadCsv, type KeywordListRecord, type KeywordListsResult, type ProjectSummary } from "@/lib/keywords";

export default function KeywordListsPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createProjectId, setCreateProjectId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [rawKeywords, setRawKeywords] = useState("");

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

  const deleteMutation = useMutation({
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

  useEffect(() => {
    if (!createProjectId && projectsQuery.data?.projects?.length) {
      setCreateProjectId(projectsQuery.data.projects[0].id);
    }
  }, [createProjectId, projectsQuery.data?.projects]);

  useEffect(() => {
    if (!selectedListId && listsQuery.data?.lists?.length) {
      setSelectedListId(listsQuery.data.lists[0].id);
    }
  }, [listsQuery.data?.lists, selectedListId]);

  useEffect(() => {
    if (selectedListId && listsQuery.data?.lists && !listsQuery.data.lists.some((list) => list.id === selectedListId)) {
      setSelectedListId(listsQuery.data.lists[0]?.id ?? "");
    }
  }, [listsQuery.data?.lists, selectedListId]);

  const lists = listsQuery.data?.lists ?? [];
  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;

  const normalizedAddKeywords = useMemo(
    () =>
      rawKeywords
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    [rawKeywords]
  );

  const exportSelected = () => {
    if (!selectedList) return;
    downloadCsv(`${selectedList.name}.csv`, [
      ["Keyword", "Location", "Language", "Device", "Added Date"],
      ...selectedList.items.map((item) => [
        item.keyword.keyword,
        item.keyword.locationCode,
        item.keyword.languageCode,
        item.keyword.device,
        new Date(item.keyword.createdAt).toLocaleDateString(),
      ]),
    ]);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Keyword Lists</h2>
          <p className="text-sm text-muted-foreground">
            Save strategic groups of keywords, export them, and keep list detail at the project level.
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
                {(projectsQuery.data?.projects ?? []).map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
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

      {!projectsQuery.isLoading && !listsQuery.isLoading && lists.length === 0 && (
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

      {!projectsQuery.isLoading && !listsQuery.isLoading && lists.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-3">
            {lists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => setSelectedListId(list.id)}
                className="w-full text-left"
              >
                <Card
                  className={
                    selectedListId === list.id ? "border-orange-500 shadow-sm" : "hover:border-border/80"
                  }
                >
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-medium">{list.name}</h3>
                        <p className="text-sm text-muted-foreground">{list.projectName}</p>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {list.items.length}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(list.createdAt).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{selectedList?.name ?? "Select a list"}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedList
                    ? `${selectedList.projectName} - ${selectedList.projectDomain}`
                    : "Choose a list from the left to inspect its keywords."}
                </p>
              </div>
              {selectedList && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                    Add Keywords
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportSelected}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(selectedList.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead>Keyword</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Language</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Added</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedList.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.keyword.keyword}</TableCell>
                          <TableCell>{item.keyword.locationCode}</TableCell>
                          <TableCell>{item.keyword.languageCode}</TableCell>
                          <TableCell className="capitalize">{item.keyword.device}</TableCell>
                          <TableCell>{new Date(item.keyword.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Keyword List</DialogTitle>
          </DialogHeader>
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
                  {(projectsQuery.data?.projects ?? []).map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!createName.trim() || !createProjectId || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <p className="text-xs text-muted-foreground">
              {normalizedAddKeywords.length} keywords ready to add
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addKeywordsMutation.mutate(normalizedAddKeywords)}
              disabled={normalizedAddKeywords.length === 0 || addKeywordsMutation.isPending || !selectedList}
            >
              {addKeywordsMutation.isPending ? "Adding..." : "Add Keywords"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
