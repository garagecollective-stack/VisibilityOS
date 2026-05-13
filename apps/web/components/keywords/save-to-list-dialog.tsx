"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { apiClient } from "@/lib/api";
import type { KeywordListRecord, KeywordListsResult, ProjectSummary } from "@/lib/keywords";

interface Props {
  keywords: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Mode = "pick" | "create";

export function SaveToListDialog({ keywords, open, onOpenChange }: Props) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>("pick");
  const [selectedListId, setSelectedListId] = useState("");
  const [newName, setNewName] = useState("");
  const [newProjectId, setNewProjectId] = useState("");

  const listsQuery = useQuery({
    queryKey: ["keyword-lists", "all"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<KeywordListsResult>("/keywords/lists", { token: token ?? undefined });
    },
    enabled: open,
  });

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ projects: ProjectSummary[] }>("/projects", { token: token ?? undefined });
    },
    enabled: open && mode === "create",
  });

  const lists = listsQuery.data?.lists ?? [];
  const projects = projectsQuery.data?.projects ?? [];
  const projectsLoaded = !projectsQuery.isLoading && projectsQuery.data !== undefined;
  const noProjects = projectsLoaded && projects.length === 0;

  useEffect(() => {
    if (!open) return;
    if (lists.length === 0) {
      setMode("create");
    } else {
      setMode("pick");
      if (!selectedListId) setSelectedListId(lists[0].id);
    }
  }, [open, lists.length]);

  useEffect(() => {
    if (projects.length > 0 && !newProjectId) {
      setNewProjectId(projects[0].id);
    }
  }, [projects, newProjectId]);

  useEffect(() => {
    if (!open) {
      setSelectedListId("");
      setNewName("");
    }
  }, [open]);

  const addToListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const token = await getToken();
      return apiClient(`/keywords/lists/${listId}/keywords`, {
        method: "POST",
        body: JSON.stringify({ keywords }),
        token: token ?? undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keyword-lists"] });
      onOpenChange(false);
    },
  });

  const createAndAddMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const { list } = await apiClient<{ list: KeywordListRecord }>("/keywords/lists", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), projectId: newProjectId || undefined }),
        token: token ?? undefined,
      });
      return apiClient(`/keywords/lists/${list.id}/keywords`, {
        method: "POST",
        body: JSON.stringify({ keywords }),
        token: token ?? undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keyword-lists"] });
      onOpenChange(false);
    },
  });

  const isPending = addToListMutation.isPending || createAndAddMutation.isPending;
  const error = addToListMutation.error ?? createAndAddMutation.error;

  const canSave =
    mode === "pick" ? !!selectedListId : !!newName.trim() && !noProjects;

  const handleSave = () => {
    if (isPending) return;
    if (mode === "pick" && selectedListId) {
      addToListMutation.mutate(selectedListId);
    } else if (mode === "create" && newName.trim()) {
      createAndAddMutation.mutate();
    }
  };

  const subtitle =
    keywords.length === 1 ? `Saving "${keywords[0]}"` : `Saving ${keywords.length} keywords`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save to List</DialogTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </DialogHeader>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("pick")}
            disabled={lists.length === 0}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${
              mode === "pick"
                ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Existing List
          </button>
          <button
            type="button"
            onClick={() => setMode("create")}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              mode === "create"
                ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            New List
          </button>
        </div>

        {mode === "pick" && (
          <div className="space-y-2">
            <Label>Select list</Label>
            {listsQuery.isLoading ? (
              <div className="h-9 animate-pulse rounded-md bg-muted" />
            ) : (
              <Select value={selectedListId} onValueChange={setSelectedListId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a list" />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                      <span className="ml-1.5 text-muted-foreground">({list.items.length})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-4">
            {noProjects ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400">
                No projects found for your organisation. Create a project from the dashboard before saving keyword lists.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="save-list-name">List name</Label>
                  <Input
                    id="save-list-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Quick wins"
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  />
                </div>
                {projects.length > 1 && (
                  <div className="space-y-2">
                    <Label>Project</Label>
                    <Select value={newProjectId} onValueChange={setNewProjectId}>
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
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to save keywords."}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isPending}>
            {isPending ? "Saving..." : "Save to List"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
