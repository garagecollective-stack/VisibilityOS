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
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from "lucide-react";
import { KdBadge } from "@/components/keywords/kd-badge";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMetric } from "@/lib/keywords";
import { cn } from "@/lib/utils";

interface CommonKeyword {
  keyword: string;
  yourPosition: number;
  competitorPosition: number;
  volume: number;
  kd: number | null;
  winner: "you" | "competitor" | "tie";
}

interface Props {
  keywords: CommonKeyword[];
  loading: boolean;
  isMock: boolean;
  competitorDomain: string;
}

type WinnerFilter = "all" | "you" | "competitor" | "tie";

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

function WinnerBadge({ winner }: { winner: CommonKeyword["winner"] }) {
  if (winner === "you")
    return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600">You ↑</span>;
  if (winner === "competitor")
    return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-500">Them ↑</span>;
  return <span className="text-xs font-medium text-muted-foreground">Tie</span>;
}

export function CommonKeywordsTable({ keywords, loading, isMock, competitorDomain }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "volume", desc: true }]);
  const [winnerFilter, setWinnerFilter] = useState<WinnerFilter>("all");

  const filtered = useMemo(() => {
    if (winnerFilter === "all") return keywords;
    return keywords.filter((k) => k.winner === winnerFilter);
  }, [keywords, winnerFilter]);

  const youWinning = keywords.filter((k) => k.winner === "you").length;
  const theyWinning = keywords.filter((k) => k.winner === "competitor").length;
  const tied = keywords.filter((k) => k.winner === "tie").length;
  const winRate = keywords.length > 0 ? Math.round((youWinning / keywords.length) * 100) : 0;

  const columns = useMemo<ColumnDef<CommonKeyword>[]>(
    () => [
      {
        accessorKey: "keyword",
        header: "Keyword",
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
        enableSorting: false,
      },
      {
        accessorKey: "yourPosition",
        header: "Your Pos",
        cell: ({ getValue }) => <PositionBadge pos={getValue<number>()} />,
      },
      {
        accessorKey: "competitorPosition",
        header: "Their Pos",
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
        accessorKey: "winner",
        header: "Winner",
        cell: ({ getValue }) => <WinnerBadge winner={getValue<CommonKeyword["winner"]>()} />,
        enableSorting: false,
      },
      {
        id: "serp",
        header: "",
        cell: ({ row }) => (
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(row.original.keyword)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            SERP
          </a>
        ),
        enableSorting: false,
      },
    ],
    []
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

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  const pageRows = table.getRowModel().rows;
  const { pageIndex, pageSize } = table.getState().pagination;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Common Keywords</p>
          <p className="text-xl font-bold tabular-nums">{keywords.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">You Winning</p>
          <p className="text-xl font-bold tabular-nums text-green-600">{youWinning}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">They Winning</p>
          <p className="text-xl font-bold tabular-nums text-red-500">{theyWinning}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Your Win Rate</p>
          <p className="text-xl font-bold tabular-nums">{winRate}%</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {isMock && <SampleDataBadge />}
        {(["all", "you", "competitor", "tie"] as WinnerFilter[]).map((f) => {
          const labels: Record<WinnerFilter, string> = {
            all: `All (${keywords.length})`,
            you: `You're Winning (${youWinning})`,
            competitor: `They're Winning (${theyWinning})`,
            tie: `Tied (${tied})`,
          };
          return (
            <button
              key={f}
              type="button"
              onClick={() => setWinnerFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm transition-colors",
                winnerFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {labels[f]}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">No common keywords found</p>
          <p className="text-sm text-muted-foreground mt-1">
            No overlap found — try adding more keywords to rank tracker
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

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
