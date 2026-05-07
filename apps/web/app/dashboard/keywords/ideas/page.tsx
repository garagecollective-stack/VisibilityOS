"use client";
import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Search, SlidersHorizontal, BookmarkPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { KdBadge } from "@/components/keywords/kd-badge";
import { IntentBadge } from "@/components/keywords/intent-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

type Intent = "Transactional" | "Informational" | "Navigational" | "Commercial";

interface KeywordIdea {
  keyword: string;
  search_volume: number;
  cpc: number;
  keyword_difficulty: number | null;
  intent: string;
}

interface Project {
  id: string;
  name: string;
  domain: string;
}

interface KeywordList {
  id: string;
  name: string;
}

type SortKey = keyof KeywordIdea;
type SortDir = "asc" | "desc";

const INTENTS: Intent[] = ["Informational", "Transactional", "Navigational", "Commercial"];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function KeywordIdeasPage() {
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ideas, setIdeas] = useState<KeywordIdea[]>([]);
  const [searched, setSearched] = useState(false);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [intentFilter, setIntentFilter] = useState<Set<Intent>>(new Set());
  const [kdMin, setKdMin] = useState("");
  const [kdMax, setKdMax] = useState("");
  const [volMin, setVolMin] = useState("");
  const [volMax, setVolMax] = useState("");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("search_volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Save to list dialog
  const [saveOpen, setSaveOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [lists, setLists] = useState<KeywordList[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [newListName, setNewListName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const search = useCallback(async (kw: string) => {
    if (!kw.trim()) return;
    setLoading(true);
    setError("");
    setSelected(new Set());
    try {
      const token = await getToken();
      const data = await apiClient<{ ideas: KeywordIdea[] }>("/keywords/ideas", {
        method: "POST",
        body: JSON.stringify({ keyword: kw.trim(), locationCode: 2356, languageCode: "en" }),
        token: token ?? undefined,
      });
      setIdeas(data.ideas);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    return ideas.filter((kw) => {
      if (intentFilter.size > 0 && !intentFilter.has(kw.intent as Intent)) return false;
      if (kdMin && (kw.keyword_difficulty ?? 0) < Number(kdMin)) return false;
      if (kdMax && (kw.keyword_difficulty ?? 101) > Number(kdMax)) return false;
      if (volMin && kw.search_volume < Number(volMin)) return false;
      if (volMax && kw.search_volume > Number(volMax)) return false;
      return true;
    });
  }, [ideas, intentFilter, kdMin, kdMax, volMin, volMax]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? -1;
      const bv = b[sortKey] ?? -1;
      const cmp = typeof av === "string" ? av.localeCompare(String(bv)) : Number(av) - Number(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((kw) => selected.has(kw.keyword));

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected((s) => { const next = new Set(s); filtered.forEach((kw) => next.delete(kw.keyword)); return next; });
    } else {
      setSelected((s) => { const next = new Set(s); filtered.forEach((kw) => next.add(kw.keyword)); return next; });
    }
  };

  const toggleOne = (keyword: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });
  };

  const openSaveDialog = async () => {
    setSaveError("");
    setSaveSuccess(false);
    setNewListName("");
    setSelectedListId("");
    setSaveOpen(true);
    try {
      const token = await getToken();
      const data = await apiClient<{ projects: Project[] }>("/projects", {
        token: token ?? undefined,
      });
      setProjects(data.projects);
      if (data.projects.length > 0) {
        setSelectedProjectId(data.projects[0].id);
        await loadLists(data.projects[0].id, token ?? undefined);
      }
    } catch {
      setSaveError("Failed to load projects");
    }
  };

  const loadLists = async (projectId: string, token?: string) => {
    if (!projectId) return;
    try {
      const t = token ?? (await getToken()) ?? undefined;
      const data = await apiClient<{ lists: KeywordList[] }>(`/keywords/projects/${projectId}/lists`, {
        token: t,
      });
      setLists(data.lists);
    } catch {
      setLists([]);
    }
  };

  const handleProjectChange = async (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedListId("");
    setLists([]);
    await loadLists(projectId);
  };

  const handleSave = async () => {
    if (!selectedProjectId) { setSaveError("Select a project"); return; }
    if (!selectedListId && !newListName.trim()) { setSaveError("Select or create a list"); return; }

    setSaving(true);
    setSaveError("");
    try {
      const token = await getToken();
      let listId = selectedListId;

      if (!listId && newListName.trim()) {
        const data = await apiClient<{ list: KeywordList }>(`/keywords/projects/${selectedProjectId}/lists`, {
          method: "POST",
          body: JSON.stringify({ name: newListName.trim() }),
          token: token ?? undefined,
        });
        listId = data.list.id;
      }

      const keywords = [...selected];
      await apiClient(`/keywords/projects/${selectedProjectId}/lists/${listId}/keywords`, {
        method: "POST",
        body: JSON.stringify({ keywords, locationCode: 2356, languageCode: "en" }),
        token: token ?? undefined,
      });

      setSaveSuccess(true);
      setTimeout(() => { setSaveOpen(false); setSelected(new Set()); }, 1200);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleIntent = (intent: Intent) => {
    setIntentFilter((s) => {
      const next = new Set(s);
      if (next.has(intent)) next.delete(intent);
      else next.add(intent);
      return next;
    });
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      <span className="ml-1 text-xs">{sortDir === "asc" ? "↑" : "↓"}</span>
    ) : (
      <span className="ml-1 text-xs opacity-30">↕</span>
    );

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Search */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Enter a seed keyword to generate ideas…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Generating…" : "Generate Ideas"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFilters((v) => !v)}
          className={cn(showFilters && "bg-accent")}
        >
          <SlidersHorizontal className="h-4 w-4 mr-1" />
          Filters
          {(intentFilter.size > 0 || kdMin || kdMax || volMin || volMax) && (
            <span className="ml-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              !
            </span>
          )}
        </Button>
      </form>

      {/* Filters panel */}
      {showFilters && (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Filters</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setIntentFilter(new Set()); setKdMin(""); setKdMax(""); setVolMin(""); setVolMax(""); }}
            >
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs mb-2 block">Search Intent</Label>
              <div className="flex flex-wrap gap-1.5">
                {INTENTS.map((intent) => (
                  <button
                    key={intent}
                    onClick={() => toggleIntent(intent)}
                    className={cn(
                      "px-2.5 py-1 rounded text-xs font-medium border transition-colors",
                      intentFilter.has(intent)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary"
                    )}
                  >
                    {intent}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs mb-2 block">Keyword Difficulty</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={kdMin}
                  onChange={(e) => setKdMin(e.target.value)}
                  className="h-8 text-xs"
                  min={0}
                  max={100}
                />
                <span className="text-muted-foreground text-xs">–</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={kdMax}
                  onChange={(e) => setKdMax(e.target.value)}
                  className="h-8 text-xs"
                  min={0}
                  max={100}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-2 block">Monthly Volume</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={volMin}
                  onChange={(e) => setVolMin(e.target.value)}
                  className="h-8 text-xs"
                  min={0}
                />
                <span className="text-muted-foreground text-xs">–</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={volMax}
                  onChange={(e) => setVolMax(e.target.value)}
                  className="h-8 text-xs"
                  min={0}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!searched && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Enter a seed keyword to generate hundreds of keyword ideas.</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="rounded-lg border bg-card overflow-hidden animate-pulse">
          <div className="h-10 bg-muted border-b" />
          {[...Array(10)].map((_, i) => <div key={i} className="h-12 border-b bg-muted/30" />)}
        </div>
      )}

      {/* Results table */}
      {searched && !loading && (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {filtered.length} keywords
              {ideas.length !== filtered.length && ` (filtered from ${ideas.length})`}
              {selected.size > 0 && ` · ${selected.size} selected`}
            </span>
            {selected.size > 0 && (
              <Button size="sm" onClick={openSaveDialog}>
                <BookmarkPlus className="h-4 w-4 mr-1.5" />
                Save {selected.size} to List
              </Button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No keywords match the current filters.
            </div>
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-2.5 w-10">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={toggleAll}
                          aria-label="Select all"
                        />
                      </th>
                      <Th onClick={() => handleSort("keyword")}>
                        Keyword <SortIcon k="keyword" />
                      </Th>
                      <Th onClick={() => handleSort("search_volume")} className="text-right">
                        Volume <SortIcon k="search_volume" />
                      </Th>
                      <Th onClick={() => handleSort("cpc")} className="text-right">
                        CPC <SortIcon k="cpc" />
                      </Th>
                      <Th onClick={() => handleSort("keyword_difficulty")} className="text-center">
                        KD <SortIcon k="keyword_difficulty" />
                      </Th>
                      <Th onClick={() => handleSort("intent")}>
                        Intent <SortIcon k="intent" />
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((kw) => (
                      <tr
                        key={kw.keyword}
                        className={cn(
                          "border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer",
                          selected.has(kw.keyword) && "bg-primary/5"
                        )}
                        onClick={() => toggleOne(kw.keyword)}
                      >
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(kw.keyword)}
                            onCheckedChange={() => toggleOne(kw.keyword)}
                          />
                        </td>
                        <td className="px-4 py-2.5 font-medium max-w-[250px] truncate">{kw.keyword}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmt(kw.search_volume)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">${kw.cpc.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <KdBadge value={kw.keyword_difficulty} />
                        </td>
                        <td className="px-4 py-2.5">
                          <IntentBadge intent={kw.intent} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Save to List dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save {selected.size} Keywords to List</DialogTitle>
          </DialogHeader>

          {saveSuccess ? (
            <div className="py-6 text-center text-sm text-green-600 font-medium">
              Keywords saved successfully!
            </div>
          ) : (
            <div className="space-y-4">
              {/* Project selector */}
              <div className="space-y-1.5">
                <Label>Project</Label>
                {projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No projects found. Create a project first.</p>
                ) : (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.domain})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* List selector */}
              {selectedProjectId && (
                <div className="space-y-1.5">
                  <Label>Add to List</Label>
                  {lists.length > 0 && (
                    <select
                      value={selectedListId}
                      onChange={(e) => { setSelectedListId(e.target.value); setNewListName(""); }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">— Create new list —</option>
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  )}
                  {(!selectedListId || lists.length === 0) && (
                    <div className="space-y-1">
                      {lists.length > 0 && (
                        <Label className="text-xs text-muted-foreground">Or create a new list</Label>
                      )}
                      <Input
                        placeholder="New list name…"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {saveError && (
                <p className="text-sm text-destructive">{saveError}</p>
              )}
            </div>
          )}

          {!saveSuccess && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || projects.length === 0}>
                {saving ? "Saving…" : "Save Keywords"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Th({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground",
        onClick && "cursor-pointer hover:text-foreground select-none",
        className
      )}
      onClick={onClick}
    >
      {children}
    </th>
  );
}
