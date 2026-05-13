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
  ChevronLeft,
  ChevronRight,
  Download,
  FileUp,
  ListFilter,
  Search,
  Star,
  X,
} from "lucide-react";
import { BulkSummaryBar } from "@/components/keywords/bulk-summary-bar";
import { CompetitionBadge } from "@/components/keywords/competition-badge";
import { IntentBadge } from "@/components/keywords/intent-badge";
import { KdBadge } from "@/components/keywords/kd-badge";
import { SaveToListDialog } from "@/components/keywords/save-to-list-dialog";
import { Sparkline } from "@/components/keywords/sparkline";
import { CountrySelector } from "@/components/shared/country-selector";
import { DeviceToggle, type Device } from "@/components/shared/device-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import { downloadCsv, exportKeywordsToCSV } from "@/lib/export-csv";
import { formatMetric, type KeywordBulkResult, type KeywordBulkRow } from "@/lib/keywords";
import { ssGet, ssParse, ssSet, ssStringify } from "@/lib/session-store";
import { cn } from "@/lib/utils";

const LOADING_MESSAGES = [
  "Fetching search volumes...",
  "Calculating keyword difficulty...",
  "Analyzing search intent...",
  "Almost done...",
];

const SAMPLE_KEYWORDS = [
  "best seo tools",
  "keyword research guide",
  "site audit checklist",
  "rank tracking software",
  "content marketing strategy",
];

type IntentFilter = "all" | "Informational" | "Commercial" | "Transactional" | "Navigational";

function isOpportunity(row: KeywordBulkRow): boolean {
  return row.search_volume > 1_000 && (row.keyword_difficulty ?? 100) < 40;
}

export default function KeywordBulkPage() {
  const { getToken } = useAuth();
  const [rawKeywords, setRawKeywords] = useState("");
  const [location, setLocation] = useState<string>("2356");
  const [device, setDevice] = useState<Device>("desktop");

  const [results, setResults] = useState<KeywordBulkResult | null>(null);
  const [resultsFor, setResultsFor] = useState("");

  // Filter state
  const [searchText, setSearchText] = useState("");
  const [intentFilter, setIntentFilter] = useState<IntentFilter>("all");
  const [kdMin, setKdMin] = useState<string>("");
  const [kdMax, setKdMax] = useState<string>("");
  const [onlyOpportunities, setOnlyOpportunities] = useState(false);

  // Selection + save dialog
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [dialogKeywords, setDialogKeywords] = useState<string[]>([]);

  // Loading state animation
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const kws = ssGet("lastBulkKeywords");
    const storedLocation = ssGet("lastBulkLocation");
    const storedDevice = ssGet("lastBulkDevice");
    const data = ssParse<KeywordBulkResult>("lastBulkResults");
    if (storedLocation) setLocation(storedLocation);
    if (storedDevice === "desktop" || storedDevice === "mobile") setDevice(storedDevice);
    if (kws !== null && data) {
      setRawKeywords(kws);
      setResults(data);
      setResultsFor(`${data.results.length} keyword${data.results.length === 1 ? "" : "s"}`);
    }
  }, []);

  const keywords = useMemo(
    () =>
      rawKeywords
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    [rawKeywords]
  );

  const keywordCount = keywords.length;
  const isOverLimit = keywordCount > 200;
  const submitKeywords = keywords.slice(0, 200);

  const bulkMutation = useMutation({
    mutationFn: async (kws: string[]) => {
      const token = await getToken();
      return apiClient<KeywordBulkResult>("/keywords/bulk", {
        method: "POST",
        body: JSON.stringify({
          keywords: kws,
          locationCode: Number(location),
          languageCode: "en",
          device,
        }),
        token: token ?? undefined,
      });
    },
    onSuccess: (data) => {
      setResults(data);
      const label = `${data.results.length} keyword${data.results.length === 1 ? "" : "s"}`;
      setResultsFor(label);
      ssSet("lastBulkKeywords", rawKeywords);
      ssSet("lastBulkLocation", location);
      ssSet("lastBulkDevice", device);
      ssStringify("lastBulkResults", data);
    },
  });

  const isPending = bulkMutation.isPending;

  // Cycle loading messages every 2s
  useEffect(() => {
    if (!isPending) {
      setLoadingMsg(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingMsg((s) => (s + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isPending]);

  // Animate progress 0 -> 90% over expected duration; clears on completion
  useEffect(() => {
    if (!isPending) {
      setProgress(0);
      return;
    }
    const start = Date.now();
    const expected = Math.max(10_000, submitKeywords.length * 80); // ~80ms/kw, min 10s
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(90, Math.round((elapsed / expected) * 90)));
    }, 200);
    return () => clearInterval(interval);
  }, [isPending, submitKeywords.length]);

  const onAnalyze = () => {
    if (submitKeywords.length === 0 || isOverLimit) return;
    setResults(null);
    setSelected(new Set());
    bulkMutation.mutate(submitKeywords);
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

  const onDownloadSample = () => {
    downloadCsv("sample-keywords.csv", [["keyword"], ...SAMPLE_KEYWORDS.map((kw) => [kw])]);
  };

  const allRows: KeywordBulkRow[] = results?.results ?? [];

  const hasTrendData = useMemo(
    () => allRows.some((r) => Array.isArray(r.monthly_searches) && r.monthly_searches.length > 0),
    [allRows]
  );

  const filtered = useMemo(() => {
    const kdMinN = kdMin.trim() !== "" ? Number(kdMin) : null;
    const kdMaxN = kdMax.trim() !== "" ? Number(kdMax) : null;
    return allRows.filter((row) => {
      if (searchText && !row.keyword.toLowerCase().includes(searchText.toLowerCase()))
        return false;
      if (intentFilter !== "all" && row.intent !== intentFilter) return false;
      if (kdMinN !== null && (row.keyword_difficulty ?? -1) < kdMinN) return false;
      if (kdMaxN !== null && (row.keyword_difficulty ?? 101) > kdMaxN) return false;
      if (onlyOpportunities && !isOpportunity(row)) return false;
      return true;
    });
  }, [allRows, searchText, intentFilter, kdMin, kdMax, onlyOpportunities]);

  const handleBulkSave = () => {
    setDialogKeywords(Array.from(selected));
    setSaveDialogOpen(true);
  };

  const handleBulkExport = () => {
    const rows = filtered.filter((r) => selected.has(r.keyword));
    exportKeywordsToCSV(`keyword-bulk-selected.csv`, rows);
  };

  const handleSaveAll = () => {
    setDialogKeywords(allRows.map((r) => r.keyword));
    setSaveDialogOpen(true);
  };

  const handleExportAll = () => {
    exportKeywordsToCSV(`keyword-bulk-results.csv`, allRows);
  };

  const showEmpty = results === null && !isPending && !bulkMutation.isError;
  const showResults = results !== null && !isPending;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Keyword Bulk Analysis</h2>
        <p className="text-sm text-muted-foreground">
          Paste up to 200 keywords or upload a CSV to compare volume, CPC, intent, and competition.
        </p>
      </div>

      {/* Input section */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <CountrySelector value={location} onValueChange={setLocation} />
            <DeviceToggle value={device} onChange={setDevice} />
            <div className="ml-auto text-xs text-muted-foreground">
              Language: <span className="font-medium text-foreground">English</span>
            </div>
          </div>

          <Textarea
            placeholder="Paste one keyword per line"
            className="min-h-52"
            value={rawKeywords}
            onChange={(event) => setRawKeywords(event.target.value)}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              className={cn(
                "text-sm",
                isOverLimit ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400",
                keywordCount === 0 && "text-muted-foreground"
              )}
            >
              {keywordCount === 0 ? (
                <>0/200 keywords ready for analysis</>
              ) : isOverLimit ? (
                <>
                  <span className="font-semibold">{keywordCount}/200</span> · Reduce to 200 keywords
                  maximum
                </>
              ) : (
                <>
                  <span className="font-semibold">{keywordCount}/200</span> keywords ready for
                  analysis
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={onDownloadSample}>
                <Download className="mr-2 h-4 w-4" />
                Sample CSV
              </Button>
              <Button asChild variant="outline">
                <label className="cursor-pointer">
                  <FileUp className="mr-2 h-4 w-4" />
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={onFileChange}
                  />
                </label>
              </Button>
              <Button onClick={onAnalyze} disabled={keywordCount === 0 || isOverLimit || isPending}>
                {isPending ? "Analyzing..." : "Analyze Keywords"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error state */}
      {bulkMutation.isError && (
        <div className="space-y-3">
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {bulkMutation.error instanceof Error
              ? bulkMutation.error.message
              : "Bulk analysis failed."}
          </div>
          <Button variant="outline" size="sm" onClick={onAnalyze}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isPending && <BulkLoadingState count={submitKeywords.length} message={LOADING_MESSAGES[loadingMsg]!} progress={progress} />}

      {/* Pre-analysis empty state */}
      {showEmpty && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <ListFilter className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <h3 className="font-medium">Paste up to 200 keywords to analyze</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Or upload a CSV file with one keyword per row. Get volume, CPC, KD, intent, and
              competition for each in seconds.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {showResults && allRows.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <ListFilter className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">No results returned</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Check your keywords and try again.
            </p>
            <Button variant="outline" size="sm" onClick={onAnalyze} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {showResults && allRows.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Showing previous results for:{" "}
            <span className="font-medium text-foreground">{resultsFor}</span>
          </p>

          <BulkSummaryBar rows={allRows} onExportAll={handleExportAll} onSaveAll={handleSaveAll} />

          {/* Filter bar */}
          <Card>
            <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_180px_140px_180px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-9"
                  placeholder="Filter by keyword…"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
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
                  inputMode="numeric"
                  placeholder="KD Min"
                  value={kdMin}
                  onChange={(e) => setKdMin(e.target.value)}
                  className="h-9"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Max"
                  value={kdMax}
                  onChange={(e) => setKdMax(e.target.value)}
                  className="h-9"
                />
              </div>
              <button
                type="button"
                onClick={() => setOnlyOpportunities((v) => !v)}
                className={cn(
                  "inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors",
                  onlyOpportunities
                    ? "border-orange-500 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-400"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={onlyOpportunities}
              >
                <Star
                  className={cn("h-3.5 w-3.5", onlyOpportunities && "fill-current")}
                />
                Show only opportunities
              </button>
            </CardContent>
          </Card>

          <BulkResultsTable
            rows={filtered}
            totalCount={allRows.length}
            hasTrendData={hasTrendData}
            selected={selected}
            onToggleRow={(kw) => {
              setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(kw)) next.delete(kw);
                else next.add(kw);
                return next;
              });
            }}
            onToggleAll={(pageRows, allChecked) => {
              setSelected((prev) => {
                const next = new Set(prev);
                if (allChecked) pageRows.forEach((kw) => next.delete(kw));
                else pageRows.forEach((kw) => next.add(kw));
                return next;
              });
            }}
            onSave={(kw) => {
              setDialogKeywords([kw]);
              setSaveDialogOpen(true);
            }}
          />
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
                Export Selected CSV
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

// ── Loading state ─────────────────────────────────────────────────────────────

function BulkLoadingState({
  count,
  message,
  progress,
}: {
  count: number;
  message: string;
  progress: number;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Analyzing {count} keyword{count === 1 ? "" : "s"}…</p>
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="space-y-2 pt-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Results table ─────────────────────────────────────────────────────────────

function BulkResultsTable({
  rows,
  totalCount,
  hasTrendData,
  selected,
  onToggleRow,
  onToggleAll,
  onSave,
}: {
  rows: KeywordBulkRow[];
  totalCount: number;
  hasTrendData: boolean;
  selected: Set<string>;
  onToggleRow: (kw: string) => void;
  onToggleAll: (pageRows: string[], allChecked: boolean) => void;
  onSave: (kw: string) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<KeywordBulkRow>[]>(() => {
    const cols: ColumnDef<KeywordBulkRow>[] = [
      {
        id: "select",
        header: ({ table }) => {
          const pageRows = table.getRowModel().rows.map((r) => r.original.keyword);
          const allChecked = pageRows.length > 0 && pageRows.every((kw) => selected.has(kw));
          return (
            <input
              type="checkbox"
              aria-label="Select all on page"
              className="h-4 w-4 cursor-pointer accent-orange-500"
              checked={allChecked}
              onChange={() => onToggleAll(pageRows, allChecked)}
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
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {isOpportunity(row.original) && (
              <Star
                className="h-3.5 w-3.5 shrink-0 fill-current text-orange-500"
                aria-label="Opportunity"
              />
            )}
            <span className="font-medium">{row.original.keyword}</span>
          </div>
        ),
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
          return v ? (
            <span className="tabular-nums">${v.toFixed(2)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        id: "competition",
        header: "Competition",
        cell: ({ row }) => (
          <CompetitionBadge
            value={row.original.competition}
            level={row.original.competition_level}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "intent",
        header: "Intent",
        cell: ({ getValue }) => <IntentBadge intent={getValue<string>()} />,
        enableSorting: false,
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
  const visibleCount = rows.length;
  const startRow = visibleCount === 0 ? 0 : pageInfo.pageIndex * pageInfo.pageSize + 1;
  const endRow = Math.min(visibleCount, (pageInfo.pageIndex + 1) * pageInfo.pageSize);

  if (rows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No rows match the current filters.
        </CardContent>
      </Card>
    );
  }

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
              {table.getRowModel().rows.map((row) => {
                const opportunity = isOpportunity(row.original);
                return (
                  <TableRow
                    key={row.id}
                    data-state={selected.has(row.original.keyword) ? "selected" : undefined}
                    className={cn(
                      opportunity &&
                        "border-l-2 border-l-green-400 bg-green-50/60 dark:bg-green-950/20"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground tabular-nums">
            Showing <span className="font-medium">{startRow}</span>–
            <span className="font-medium">{endRow}</span> of{" "}
            <span className="font-medium">{visibleCount.toLocaleString()}</span>
            {visibleCount !== totalCount && (
              <> (filtered from {totalCount.toLocaleString()})</>
            )}
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
