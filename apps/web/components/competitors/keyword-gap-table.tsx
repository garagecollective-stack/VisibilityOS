"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Star } from "lucide-react";
import { KdBadge } from "@/components/keywords/kd-badge";
import { IntentBadge } from "@/components/keywords/intent-badge";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMetric, downloadCsv } from "@/lib/keywords";
import { cn } from "@/lib/utils";

interface GapKeyword {
  keyword: string;
  competitorPosition: number;
  volume: number;
  kd: number | null;
  cpc: number;
  intent: string;
}

interface Props {
  keywords: GapKeyword[];
  loading: boolean;
  isMock: boolean;
  competitorDomain: string;
  onTrackKeyword?: (keyword: string) => void;
}

function PositionBadge({ pos }: { pos: number }) {
  const color =
    pos <= 3
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : pos <= 10
        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        : pos <= 20
          ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tabular-nums", color)}>
      #{pos}
    </span>
  );
}

export function KeywordGapTable({ keywords, loading, isMock, competitorDomain, onTrackKeyword }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "volume", desc: true }]);
  const [search, setSearch] = useState("");
  const [maxKd, setMaxKd] = useState("");
  const [minVolume, setMinVolume] = useState("");
  const [intentFilter, setIntentFilter] = useState("all");
  const [opportunitiesOnly, setOpportunitiesOnly] = useState(false);

  const filtered = useMemo(() => {
    let rows = keywords;
    if (search) rows = rows.filter((r) => r.keyword.toLowerCase().includes(search.toLowerCase()));
    if (maxKd) rows = rows.filter((r) => (r.kd ?? 101) <= parseInt(maxKd, 10));
    if (minVolume) rows = rows.filter((r) => r.volume >= parseInt(minVolume, 10));
    if (intentFilter !== "all") rows = rows.filter((r) => r.intent === intentFilter);
    if (opportunitiesOnly) rows = rows.filter((r) => r.volume > 500 && (r.kd ?? 101) < 40);
    return rows;
  }, [keywords, search, maxKd, minVolume, intentFilter, opportunitiesOnly]);

  const avgVolume = filtered.length > 0
    ? Math.round(filtered.reduce((s, r) => s + r.volume, 0) / filtered.length)
    : 0;
  const lowCompCount = filtered.filter((r) => (r.kd ?? 101) < 40).length;

  const columns = useMemo<ColumnDef<GapKeyword>[]>(
    () => [
      {
        accessorKey: "keyword",
        header: "Keyword",
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
        enableSorting: false,
      },
      {
        accessorKey: "competitorPosition",
        header: "Competitor Pos",
        cell: ({ getValue }) => <PositionBadge pos={getValue<number>()} />,
      },
      {
        accessorKey: "volume",
        header: "Volume",
        cell: ({ getValue }) => <span className="tabular-nums">{formatMetric(getValue<number>())}</span>,
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
        id: "opportunity",
        header: "Opp",
        cell: ({ row }) => {
          const isOpp = row.original.volume > 500 && (row.original.kd ?? 101) < 40;
          return isOpp ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> : null;
        },
        enableSorting: false,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            {onTrackKeyword && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onTrackKeyword(row.original.keyword)}
              >
                Track
              </Button>
            )}
          </div>
        ),
        enableSorting: false,
      },
    ],
    [onTrackKeyword]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  function handleExport() {
    const rows = [
      ["Keyword", "Competitor Position", "Volume", "KD", "CPC", "Intent"],
      ...filtered.map((r) => [
        r.keyword,
        String(r.competitorPosition),
        String(r.volume),
        r.kd != null ? String(r.kd) : "",
        r.cpc ? r.cpc.toFixed(2) : "",
        r.intent,
      ]),
    ];
    downloadCsv(`gap-keywords-${competitorDomain}.csv`, rows);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  const pageRows = table.getRowModel().rows;
  const { pageIndex, pageSize } = table.getState().pagination;

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Gap Keywords</p>
          <p className="text-xl font-bold tabular-nums">{filtered.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Avg Volume</p>
          <p className="text-xl font-bold tabular-nums">{formatMetric(avgVolume)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Low KD Opportunities</p>
          <p className="text-xl font-bold tabular-nums text-green-600">{lowCompCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Export</p>
            <p className="text-sm text-muted-foreground">CSV</p>
          </div>
          <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {isMock && <SampleDataBadge />}
        <Input
          placeholder="Search keywords..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-48 text-sm"
        />
        <Input
          type="number"
          placeholder="Max KD"
          value={maxKd}
          onChange={(e) => setMaxKd(e.target.value)}
          className="h-8 w-24 text-sm"
        />
        <Input
          type="number"
          placeholder="Min Volume"
          value={minVolume}
          onChange={(e) => setMinVolume(e.target.value)}
          className="h-8 w-28 text-sm"
        />
        <Select value={intentFilter} onValueChange={setIntentFilter}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="Intent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Intents</SelectItem>
            <SelectItem value="Informational">Informational</SelectItem>
            <SelectItem value="Commercial">Commercial</SelectItem>
            <SelectItem value="Transactional">Transactional</SelectItem>
            <SelectItem value="Navigational">Navigational</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 cursor-pointer text-sm">
          <input
            type="checkbox"
            className="accent-yellow-500"
            checked={opportunitiesOnly}
            onChange={(e) => setOpportunitiesOnly(e.target.checked)}
          />
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
          Opportunities only
        </label>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">No keyword gaps found</p>
          <p className="text-sm text-muted-foreground mt-1">
            You're tracking everything this competitor ranks for!
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="bg-muted/30 hover:bg-muted/30">
                    {hg.headers.map((header) => {
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
                            {canSort && (
                              sort === "asc" ? <ArrowUp className="h-3 w-3" />
                              : sort === "desc" ? <ArrowDown className="h-3 w-3" />
                              : <ArrowUpDown className="h-3 w-3 opacity-30" />
                            )}
                          </span>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow key={row.id}>
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

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
