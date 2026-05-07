"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Trash2, Download, ChevronDown, ChevronRight, List, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api";

interface Project {
  id: string;
  name: string;
  domain: string;
}

interface TrackedKeyword {
  id: string;
  keyword: string;
  locationCode: string;
  languageCode: string;
  device: string;
  createdAt: string;
}

interface ListItem {
  id: string;
  keywordId: string;
  listId: string;
  keyword: TrackedKeyword;
}

interface KeywordList {
  id: string;
  name: string;
  projectId: string;
  createdAt: string;
  items: ListItem[];
}

export default function KeywordListsPage() {
  const { getToken } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [lists, setLists] = useState<KeywordList[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingLists, setLoadingLists] = useState(false);
  const [error, setError] = useState("");

  // Create list dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Expanded lists
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const token = await getToken();
      const data = await apiClient<{ projects: Project[] }>("/projects", {
        token: token ?? undefined,
      });
      setProjects(data.projects);
      if (data.projects.length > 0) {
        setSelectedProjectId(data.projects[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoadingProjects(false);
    }
  }, [getToken]);

  const loadLists = useCallback(async (projectId: string) => {
    if (!projectId) return;
    setLoadingLists(true);
    setError("");
    try {
      const token = await getToken();
      const data = await apiClient<{ lists: KeywordList[] }>(
        `/keywords/projects/${projectId}/lists`,
        { token: token ?? undefined }
      );
      setLists(data.lists);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lists");
    } finally {
      setLoadingLists(false);
    }
  }, [getToken]);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { if (selectedProjectId) loadLists(selectedProjectId); }, [selectedProjectId, loadLists]);

  const handleCreateList = async () => {
    if (!newListName.trim()) { setCreateError("List name is required"); return; }
    setCreating(true);
    setCreateError("");
    try {
      const token = await getToken();
      await apiClient(`/keywords/projects/${selectedProjectId}/lists`, {
        method: "POST",
        body: JSON.stringify({ name: newListName.trim() }),
        token: token ?? undefined,
      });
      setCreateOpen(false);
      setNewListName("");
      await loadLists(selectedProjectId);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create list");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm("Delete this list? This cannot be undone.")) return;
    try {
      const token = await getToken();
      await apiClient(`/keywords/projects/${selectedProjectId}/lists/${listId}`, {
        method: "DELETE",
        token: token ?? undefined,
      });
      setLists((prev) => prev.filter((l) => l.id !== listId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete list");
    }
  };

  const handleRemoveKeyword = async (listId: string, itemId: string) => {
    try {
      const token = await getToken();
      await apiClient(
        `/keywords/projects/${selectedProjectId}/lists/${listId}/keywords/${itemId}`,
        { method: "DELETE", token: token ?? undefined }
      );
      setLists((prev) =>
        prev.map((l) =>
          l.id === listId ? { ...l, items: l.items.filter((i) => i.id !== itemId) } : l
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove keyword");
    }
  };

  const handleExport = async (list: KeywordList) => {
    const token = await getToken();
    const apiUrl = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
    const url = `${apiUrl}/api/keywords/projects/${selectedProjectId}/lists/${list.id}/export`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { setError("Export failed"); return; }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${list.name}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toggleExpand = (listId: string) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(listId)) next.delete(listId);
      else next.add(listId);
      return next;
    });
  };

  if (loadingProjects) {
    return (
      <div className="space-y-4 animate-pulse max-w-3xl">
        <div className="h-10 rounded bg-muted w-48" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-lg border bg-muted" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Project selector + Create button */}
      <div className="flex items-center gap-3 flex-wrap">
        {projects.length > 1 && (
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Project:</Label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.domain})
                </option>
              ))}
            </select>
          </div>
        )}
        {projects.length === 1 && (
          <span className="text-sm text-muted-foreground">
            Project: <strong>{projects[0].name}</strong>
          </span>
        )}
        <Button
          size="sm"
          onClick={() => { setCreateError(""); setCreateOpen(true); }}
          disabled={!selectedProjectId}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New List
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <List className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No projects yet. Create a project to start building keyword lists.</p>
        </div>
      )}

      {loadingLists ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-lg border bg-muted" />)}
        </div>
      ) : lists.length === 0 && selectedProjectId ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed">
          <List className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">No lists yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create a list to save and organise keywords from the Ideas tab.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            onClick={() => { setCreateError(""); setCreateOpen(true); }}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Create your first list
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map((list) => {
            const isExpanded = expanded.has(list.id);
            return (
              <div key={list.id} className="rounded-lg border bg-card overflow-hidden">
                {/* List header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleExpand(list.id)}
                    className="flex items-center gap-2 flex-1 text-left hover:text-foreground transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium text-sm">{list.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {list.items.length} keyword{list.items.length !== 1 ? "s" : ""}
                    </span>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => handleExport(list)}
                      title="Export CSV"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteList(list.id)}
                      title="Delete list"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Keywords */}
                {isExpanded && (
                  <div className="border-t">
                    {list.items.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-muted-foreground">
                        No keywords yet. Save keywords from the Ideas tab.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/20">
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Keyword</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">
                              Location
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">
                              Added
                            </th>
                            <th className="px-4 py-2 w-10" />
                          </tr>
                        </thead>
                        <tbody>
                          {list.items.map((item) => (
                            <tr key={item.id} className="border-b last:border-0 hover:bg-muted/10 group">
                              <td className="px-4 py-2.5 font-medium">{item.keyword.keyword}</td>
                              <td className="px-4 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">
                                {item.keyword.locationCode} / {item.keyword.languageCode}
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">
                                {new Date(item.keyword.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-2.5">
                                <button
                                  onClick={() => handleRemoveKeyword(list.id, item.id)}
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                                  title="Remove from list"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create list dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Keyword List</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>List name</Label>
              <Input
                placeholder="e.g. Top of Funnel Keywords"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
                autoFocus
              />
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreateList} disabled={creating || !newListName.trim()}>
              {creating ? "Creating…" : "Create List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

