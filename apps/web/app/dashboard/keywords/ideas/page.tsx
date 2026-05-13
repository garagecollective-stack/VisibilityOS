"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "@tanstack/react-query";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Lightbulb,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { IntentBadge } from "@/components/keywords/intent-badge";
import { KdBadge } from "@/components/keywords/kd-badge";
import { SaveToListDialog } from "@/components/keywords/save-to-list-dialog";
import { Sparkline } from "@/components/keywords/sparkline";
import {
  ALL_INTENTS,
  DEFAULT_FILTERS,
  IdeasFilterPanel,
  countActiveFilters,
  type IdeasFilters,
  type Intent,
} from "@/components/keywords/ideas-filter-panel";
import { IdeasSummaryBar } from "@/components/keywords/ideas-summary-bar";
import { CountrySelector } from "@/components/shared/country-selector";
import { DeviceToggle, type Device } from "@/components/shared/device-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { exportKeywordsToCSV, formatMetric, type KeywordIdeaResult, type KeywordRow } from "@/lib/keywords";
import { ssGet, ssParse, ssSet, ssStringify } from "@/lib/session-store";
import { cn } from "@/lib/utils";

type TabValue = "all" | "questions" | "low_comp" | "by_intent" | "by_topic";

const QUESTION_WORDS = [
  "who", "what", "when", "where", "why", "how",
  "is", "are", "can", "does", "do", "which", "should", "will",
];
const QUESTION_RE = new RegExp(`\\b(${QUESTION_WORDS.join("|")})\\b`, "i");

const LOADING_MESSAGES = [
  "Fetching search volumes...",
  "Calculating keyword difficulty...",
  "Analyzing search intent...",
  "Almost done...",
];

function isQuestion(keyword: string): boolean {
  return QUESTION_RE.test(keyword);
}

function wordCount(keyword: string): number {
  return keyword.trim().split(/\s+/).length;
}

function ctrForKd(kd: number | null): number {
  if (kd == null) return 0.15;
  if (kd <= 30) return 0.28;
  if (kd <= 60) return 0.15;
  return 0.08;
}

function applyFilters(rows: KeywordRow[], filters: IdeasFilters): KeywordRow[] {
  return rows.filter((row) => {
    if (filters.volMin != null && row.search_volume < filters.volMin) return false;
    if (filters.volMax != null && row.search_volume > filters.volMax) return false;
    if (filters.kdMin != null && (row.keyword_difficulty ?? -1) < filters.kdMin) return false;
    if (filters.kdMax != null && (row.keyword_difficulty ?? 101) > filters.kdMax) return false;
    if (filters.cpcMin != null && row.cpc < filters.cpcMin) return false;
    if (filters.cpcMax != null && row.cpc > filters.cpcMax) return false;
    if (!filters.intents.includes(row.intent as Intent)) return false;
    if (filters.include.length > 0) {
      const lk = row.keyword.toLowerCase();
      if (!filters.include.some((t) => lk.includes(t.toLowerCase()))) return false;
    }
    if (filters.exclude.length > 0) {
      const lk = row.keyword.toLowerCase();
      if (filters.exclude.some((t) => lk.includes(t.toLowerCase()))) return false;
    }
    const wc = wordCount(row.keyword);
    if (filters.wordCount === "2" && wc !== 2) return false;
    if (filters.wordCount === "3" && wc !== 3) return false;
    if (filters.wordCount === "4plus" && wc < 4) return false;
    return true;
  });
}

export default function KeywordIdeasPage() {
  const { getToken } = useAuth();
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState<string>("2356");
  const [device, setDevice] = useState<Device>("desktop");
  const [tab, setTab] = useState<TabValue>("all");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = useState<IdeasFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [dialogKeywords, setDialogKeywords] = useState<string[]>([]);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [phraseMatch, setPhraseMatch] = useState(false);

  const [results, setResults] = useState<KeywordIdeaResult | null>(null);
  const [resultsFor, setResultsFor] = useState("");

  useEffect(() => {
    const storedKeyword = ssGet("lastIdeasKeyword");
    const storedLocation = ssGet("lastIdeasLocation");
    const storedDevice = ssGet("lastIdeasDevice");
    const data = ssParse<KeywordIdeaResult>("lastIdeasResults");
    if (storedLocation) setLocation(storedLocation);
    if (storedDevice === "desktop" || storedDevice === "mobile") setDevice(storedDevice);
    if (storedKeyword && data) {
      setKeyword(storedKeyword);
      setResults(data);
      setResultsFor(storedKeyword);
    }
  }, []);

  const ideasMutation = useMutation({
    mutationFn: async ({ seed, locationCode, dev }: { seed: string; locationCode: string; dev: Device }) => {
      const token = await getToken();
      const query = new URLSearchParams({ keyword: seed, location: locationCode, device: dev });
      return apiClient<KeywordIdeaResult>(`/keywords/ideas?${query.toString()}`, {
        method: "GET",
        token: token ?? undefined,
      });
    },
    onSuccess: (data, { seed, locationCode, dev }) => {
      setResults(data);
      setResultsFor(seed);
      ssSet("lastIdeasKeyword", seed);
      ssSet("lastIdeasLocation", locationCode);
      ssSet("lastIdeasDevice", dev);
      ssStringify("lastIdeasResults", data);
    },
  });

  // Cycle loading messages every 2s while generating
  useEffect(() => {
    if (!ideasMutation.isPending) {
      setLoadingMsg(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingMsg((s) => (s + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [ideasMutation.isPending]);

  const allIdeas = results?.ideas ?? [];
  const afterFilters = useMemo(() => applyFilters(allIdeas, filters), [allIdeas, filters]);

  const afterPhraseMatch = useMemo(() => {
    if (!phraseMatch || !resultsFor) return afterFilters;
    const seed = resultsFor.toLowerCase();
    return afterFilters.filter((r) => r.keyword.toLowerCase().includes(seed));
  }, [afterFilters, phraseMatch, resultsFor]);

  const hasTrendData = useMemo(
    () => allIdeas.some((r) => Array.isArray(r.monthly_searches) && r.monthly_searches.length > 0),
    [allIdeas]
  );

  const tabCounts = useMemo(
    () => ({
      all: afterPhraseMatch.length,
      questions: afterPhraseMatch.filter((r) => isQuestion(r.keyword)).length,
      low_comp: afterPhraseMatch.filter((r) => (r.keyword_difficulty ?? 100) < 30).length,
      by_intent: afterPhraseMatch.length,
      by_topic: afterPhraseMatch.length,
    }),
    [afterPhraseMatch]
  );

  const tabFiltered = useMemo(() => {
    if (tab === "questions") return afterPhraseMatch.filter((r) => isQuestion(r.keyword));
    if (tab === "low_comp") return afterPhraseMatch.filter((r) => (r.keyword_difficulty ?? 100) < 30);
    return afterPhraseMatch;
  }, [afterPhraseMatch, tab]);

  const activeFilterCount = countActiveFilters(filters);
  const hasResults = results !== null;
  const isLoading = ideasMutation.isPending;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!keyword.trim()) return;
    setSelected(new Set());
    setResults(null);
    ideasMutation.mutate({ seed: keyword.trim(), locationCode: location, dev: device });
  };

  const toggleRow = (kw: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw);
      else next.add(kw);
      return next;
    });
  };

  const handleBulkSave = () => {
    setDialogKeywords(Array.from(selected));
    setSaveDialogOpen(true);
  };

  const handleBulkExport = () => {
    const rows = tabFiltered.filter((r) => selected.has(r.keyword));
    exportKeywordsToCSV(`keyword-ideas-selected.csv`, rows);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Keyword Ideas</h2>
        <p className="text-sm text-muted-foreground">
          Generate adjacent keyword opportunities and explore them by intent, competition, or question phrasing.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Seed keyword"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
          <CountrySelector value={location} onValueChange={setLocation} />
          <Button type="submit" disabled={!keyword.trim() || isLoading}>
            {isLoading ? "Generating..." : "Generate Ideas"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setFilterPanelOpen((o) => !o)}
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground tabular-nums">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <DeviceToggle value={device} onChange={setDevice} />
          <div className="ml-auto text-xs text-muted-foreground">
            Language: <span className="font-medium text-foreground">English</span>
          </div>
        </div>
      </form>

      {filterPanelOpen && (
        <IdeasFilterPanel
          filters={filters}
          onApply={(next) => {
            setFilters(next);
            setSelected(new Set());
          }}
          onReset={() => {
            setFilters(DEFAULT_FILTERS);
            setSelected(new Set());
          }}
        />
      )}

      {ideasMutation.isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {ideasMutation.error instanceof Error
            ? ideasMutation.error.message
            : "Failed to generate ideas."}
        </div>
      )}

      {isLoading && <GeneratingState message={LOADING_MESSAGES[loadingMsg]!} />}

      {!isLoading && !hasResults && (
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

      {!isLoading && hasResults && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Showing previous results for:{" "}
            <span className="font-medium text-foreground">{resultsFor}</span>
          </p>

          <IdeasSummaryBar
            total={allIdeas.length}
            visible={afterFilters.length}
            rows={afterFilters}
            onExportAll={() => exportKeywordsToCSV(`keyword-ideas-${resultsFor}.csv`, allIdeas)}
            onExportFiltered={() =>
              exportKeywordsToCSV(`keyword-ideas-${resultsFor}-filtered.csv`, afterFilters)
            }
          />

          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
              <TabsList className="inline-flex w-auto">
                <TabsTrigger value="all" className="gap-1.5">
                  All
                  <CountBadge value={tabCounts.all} />
                </TabsTrigger>
                <TabsTrigger value="questions" className="gap-1.5">
                  Questions
                  <CountBadge value={tabCounts.questions} />
                </TabsTrigger>
                <TabsTrigger value="low_comp" className="gap-1.5">
                  Low Comp
                  <CountBadge value={tabCounts.low_comp} accent="green" />
                </TabsTrigger>
                <TabsTrigger value="by_intent" className="gap-1.5">
                  By Intent
                  <CountBadge value={tabCounts.by_intent} />
                </TabsTrigger>
                <TabsTrigger value="by_topic" className="gap-1.5">
                  By Topic
                  <CountBadge value={tabCounts.by_topic} />
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <button
              type="button"
              onClick={() => setPhraseMatch((p) => !p)}
              className={cn(
                "ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                phraseMatch
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
              title="Phrase match: only show keywords containing the seed keyword"
            >
              <span className="h-2 w-2 rounded-full border border-current" />
              {phraseMatch ? "Phrase" : "Broad"}
            </button>
          </div>

          {tab === "by_topic" ? (
            <ByTopicView
              rows={tabFiltered}
              selected={selected}
              onToggleRow={toggleRow}
              onSave={(kw) => {
                setDialogKeywords([kw]);
                setSaveDialogOpen(true);
              }}
            />
          ) : tab === "by_intent" ? (
            <ByIntentView
              rows={tabFiltered}
              hasTrendData={hasTrendData}
              selected={selected}
              onToggleRow={toggleRow}
              onSave={(kw) => {
                setDialogKeywords([kw]);
                setSaveDialogOpen(true);
              }}
            />
          ) : tabFiltered.length === 0 ? (
            <EmptyResultsState
              hasFilters={activeFilterCount > 0}
              onClearFilters={() => {
                setFilters(DEFAULT_FILTERS);
                setSelected(new Set());
              }}
            />
          ) : (
            <IdeasTable
              rows={tabFiltered}
              hasTrendData={hasTrendData}
              selected={selected}
              onToggleRow={toggleRow}
              onToggleAll={(rowsOnPage, allChecked) => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (allChecked) rowsOnPage.forEach((kw) => next.delete(kw));
                  else rowsOnPage.forEach((kw) => next.add(kw));
                  return next;
                });
              }}
              onSave={(kw) => {
                setDialogKeywords([kw]);
                setSaveDialogOpen(true);
              }}
            />
          )}
        </div>
      )}

      {/* Sticky bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 z-10">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-lg border bg-popover/95 px-4 py-3 shadow-lg backdrop-blur">
            <span className="text-sm font-medium">
              {selected.size} keyword{selected.size === 1 ? "" : "s"} selected
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleBulkExport}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export Selected
              </Button>
              <Button size="sm" onClick={handleBulkSave}>
                <Bookmark className="mr-1.5 h-3.5 w-3.5" />
                Save to List
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

      <SaveToListDialog
        keywords={dialogKeywords}
        open={saveDialogOpen}
        onOpenChange={(open) => {
          setSaveDialogOpen(open);
          if (!open && dialogKeywords.length > 1) setSelected(new Set());
        }}
      />
    </div>
  );
}

function CountBadge({ value, accent }: { value: number; accent?: "green" }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        accent === "green"
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-muted text-muted-foreground"
      )}
    >
      {value}
    </span>
  );
}

// ── Paginated, sortable table ────────────────────────────────────────────────

function IdeasTable({
  rows,
  hasTrendData,
  selected,
  onToggleRow,
  onToggleAll,
  onSave,
}: {
  rows: KeywordRow[];
  hasTrendData: boolean;
  selected: Set<string>;
  onToggleRow: (kw: string) => void;
  onToggleAll: (rowsOnPage: string[], allChecked: boolean) => void;
  onSave: (kw: string) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<KeywordRow>[]>(() => {
    const cols: ColumnDef<KeywordRow>[] = [
      {
        id: "select",
        header: ({ table }) => {
          const rowsOnPage = table.getRowModel().rows.map((r) => r.original.keyword);
          const allChecked = rowsOnPage.length > 0 && rowsOnPage.every((kw) => selected.has(kw));
          return (
            <input
              type="checkbox"
              aria-label="Select all"
              className="h-4 w-4 cursor-pointer accent-orange-500"
              checked={allChecked}
              onChange={() => onToggleAll(rowsOnPage, allChecked)}
            />
          );
        },
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.keyword}`}
            className="h-4 w-4 cursor-pointer accent-orange-500"
            checked={selected.has(row.original.keyword)}
            onChange={() => onToggleRow(row.original.keyword)}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "keyword",
        header: "Keyword",
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
      },
      {
        accessorKey: "search_volume",
        header: "Volume",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{formatMetric(getValue<number>())}</span>
        ),
      },
      {
        accessorKey: "keyword_difficulty",
        header: "KD",
        cell: ({ getValue }) => <KdBadge value={getValue<number | null>()} />,
        sortingFn: (a, b) =>
          (a.original.keyword_difficulty ?? -1) - (b.original.keyword_difficulty ?? -1),
      },
      {
        accessorKey: "cpc",
        header: "CPC",
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return v ? <span className="tabular-nums">${v.toFixed(2)}</span> : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        accessorKey: "intent",
        header: "Intent",
        cell: ({ getValue }) => <IntentBadge intent={getValue<string>()} />,
        enableSorting: false,
      },
      {
        id: "est_clicks",
        header: "Est. Clicks",
        cell: ({ row }) => {
          const clicks = Math.round(row.original.search_volume * ctrForKd(row.original.keyword_difficulty));
          return <span className="tabular-nums text-xs">{formatMetric(clicks)}</span>;
        },
        sortingFn: (a, b) =>
          Math.round(a.original.search_volume * ctrForKd(a.original.keyword_difficulty)) -
          Math.round(b.original.search_volume * ctrForKd(b.original.keyword_difficulty)),
      },
    ];
    if (hasTrendData) {
      cols.push({
        id: "trend",
        header: "Trend",
        cell: ({ row }) => (
          <div className="h-8 w-20">
            <Sparkline data={row.original.monthly_searches} height={32} />
          </div>
        ),
        enableSorting: false,
      });
    }
    cols.push({
      id: "save",
      header: "",
      cell: ({ row }) => (
        <button
          type="button"
          title="Save to list"
          onClick={() => onSave(row.original.keyword)}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bookmark className="h-4 w-4" />
        </button>
      ),
      enableSorting: false,
    });
    return cols;
  }, [selected, hasTrendData, onToggleAll, onToggleRow, onSave]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const pageInfo = table.getState().pagination;
  const totalPages = table.getPageCount();
  const totalRows = rows.length;
  const startRow = totalRows === 0 ? 0 : pageInfo.pageIndex * pageInfo.pageSize + 1;
  const endRow = Math.min(totalRows, (pageInfo.pageIndex + 1) * pageInfo.pageSize);

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
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
                <TableRow key={row.id} data-state={selected.has(row.original.keyword) ? "selected" : undefined}>
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

        <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground tabular-nums">
            Showing <span className="font-medium">{startRow}</span>–
            <span className="font-medium">{endRow}</span> of{" "}
            <span className="font-medium">{totalRows.toLocaleString()}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              Page {pageInfo.pageIndex + 1} of {Math.max(1, totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── By Intent grouped view ───────────────────────────────────────────────────

function ByIntentView({
  rows,
  hasTrendData,
  selected,
  onToggleRow,
  onSave,
}: {
  rows: KeywordRow[];
  hasTrendData: boolean;
  selected: Set<string>;
  onToggleRow: (kw: string) => void;
  onSave: (kw: string) => void;
}) {
  const groups = useMemo(() => {
    return ALL_INTENTS.map((intent) => ({
      intent,
      rows: rows.filter((r) => r.intent === intent),
    })).filter((g) => g.rows.length > 0);
  }, [rows]);

  if (groups.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No keywords match the current filters.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.intent}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              <span className="mr-2">{group.intent}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {group.rows.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-3">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-10" />
                  <TableHead>Keyword</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-center">KD</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  {hasTrendData && <TableHead className="min-w-20">Trend</TableHead>}
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.rows.map((row) => (
                  <TableRow key={row.keyword}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-orange-500"
                        checked={selected.has(row.keyword)}
                        onChange={() => onToggleRow(row.keyword)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{row.keyword}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMetric(row.search_volume)}
                    </TableCell>
                    <TableCell className="text-center">
                      <KdBadge value={row.keyword_difficulty} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${row.cpc.toFixed(2)}
                    </TableCell>
                    {hasTrendData && (
                      <TableCell>
                        <div className="h-8 w-20">
                          <Sparkline data={row.monthly_searches} height={32} />
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <button
                        type="button"
                        title="Save to list"
                        onClick={() => onSave(row.keyword)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Bookmark className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── By Topic grouped view ────────────────────────────────────────────────────

const TOPIC_STOPWORDS = new Set([
  "best", "top", "how", "what", "is", "are", "a", "an", "the", "to", "for",
  "of", "and", "or", "in", "with", "vs", "versus", "free", "cheap", "online",
  "do", "does", "can", "will", "my", "your", "get", "use", "using", "used",
]);

function getTopicKey(keyword: string): string {
  const words = keyword.toLowerCase().split(/\s+/);
  for (const word of words) {
    if (word.length > 2 && !TOPIC_STOPWORDS.has(word)) return word;
  }
  return words[0] ?? keyword;
}

function ByTopicView({
  rows,
  selected,
  onToggleRow,
  onSave,
}: {
  rows: KeywordRow[];
  selected: Set<string>;
  onToggleRow: (kw: string) => void;
  onSave: (kw: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, KeywordRow[]>();
    for (const row of rows) {
      const key = getTopicKey(row.keyword);
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, row]);
    }
    const other: KeywordRow[] = [];
    const result: Array<{ topic: string; rows: KeywordRow[] }> = [];
    for (const [topic, kws] of map.entries()) {
      const sorted = [...kws].sort((a, b) => b.search_volume - a.search_volume);
      if (kws.length >= 2) {
        result.push({ topic: topic.charAt(0).toUpperCase() + topic.slice(1), rows: sorted });
      } else {
        other.push(...kws);
      }
    }
    if (other.length > 0) {
      result.push({ topic: "Other Topics", rows: other.sort((a, b) => b.search_volume - a.search_volume) });
    }
    return result.sort((a, b) => {
      if (a.topic === "Other Topics") return 1;
      if (b.topic === "Other Topics") return -1;
      return b.rows.reduce((s, r) => s + r.search_volume, 0) - a.rows.reduce((s, r) => s + r.search_volume, 0);
    });
  }, [rows]);

  const [open, setOpen] = useState<Set<string>>(
    new Set(groups.slice(0, 4).map((g) => g.topic))
  );

  if (groups.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No keywords match the current filters.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const isOpen = open.has(group.topic);
        return (
          <Card key={group.topic} className="overflow-hidden">
            <button
              type="button"
              onClick={() =>
                setOpen((prev) => {
                  const next = new Set(prev);
                  if (next.has(group.topic)) next.delete(group.topic);
                  else next.add(group.topic);
                  return next;
                })
              }
              className="flex w-full items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                {group.topic}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {group.rows.length}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                ~{formatMetric(group.rows.reduce((s, r) => s + r.search_volume, 0))} vol
              </span>
            </button>
            {isOpen && (
              <div className="border-t">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-10" />
                      <TableHead>Keyword</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-center">KD</TableHead>
                      <TableHead className="text-right">Est. Clicks</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((row) => (
                      <TableRow key={row.keyword}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer accent-orange-500"
                            checked={selected.has(row.keyword)}
                            onChange={() => onToggleRow(row.keyword)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{row.keyword}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {formatMetric(row.search_volume)}
                        </TableCell>
                        <TableCell className="text-center">
                          <KdBadge value={row.keyword_difficulty} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {formatMetric(Math.round(row.search_volume * ctrForKd(row.keyword_difficulty)))}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            title="Save to list"
                            onClick={() => onSave(row.keyword)}
                            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Bookmark className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function GeneratingState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Generating keyword ideas…</p>
          <p className="text-xs text-muted-foreground transition-opacity">{message}</p>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyResultsState({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-14 text-center">
        <Lightbulb className="mb-4 h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium">No keyword ideas found</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Try a different seed keyword or adjust your filters.
        </p>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters} className="mt-4">
            Clear Filters
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
