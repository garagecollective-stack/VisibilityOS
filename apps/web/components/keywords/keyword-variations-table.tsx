"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Bookmark, Plus } from "lucide-react";
import { IntentBadge } from "@/components/keywords/intent-badge";
import { KdBadge } from "@/components/keywords/kd-badge";
import { SaveToListDialog } from "@/components/keywords/save-to-list-dialog";
import { Sparkline } from "@/components/keywords/sparkline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMetric, type KeywordRow } from "@/lib/keywords";
import { cn } from "@/lib/utils";

const INITIAL_ROWS = 10;
const ROW_STEP = 10;

interface Props {
  keywords: KeywordRow[];
  loading?: boolean;
}

export function KeywordVariationsTable({ keywords, loading }: Props) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "search_volume", desc: true },
  ]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogKeywords, setDialogKeywords] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const columns = useMemo<ColumnDef<KeywordRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => {
          const visibleRows = table.getRowModel().rows.slice(0, visibleCount);
          const visibleKws = visibleRows.map((r) => r.original.keyword);
          const allSelected = visibleKws.length > 0 && visibleKws.every((kw) => selected.has(kw));
          return (
            <input
              type="checkbox"
              aria-label="Select all"
              className="h-4 w-4 cursor-pointer accent-orange-500"
              checked={allSelected}
              onChange={(e) => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) visibleKws.forEach((kw) => next.add(kw));
                  else visibleKws.forEach((kw) => next.delete(kw));
                  return next;
                });
              }}
            />
          );
        },
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.keyword}`}
            className="h-4 w-4 cursor-pointer accent-orange-500"
            checked={selected.has(row.original.keyword)}
            onChange={(e) => {
              const kw = row.original.keyword;
              setSelected((prev) => {
                const next = new Set(prev);
                if (e.target.checked) next.add(kw);
                else next.delete(kw);
                return next;
              });
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "keyword",
        header: "Keyword",
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>()}</span>
        ),
        enableSorting: false,
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
        sortingFn: (a, b) => {
          const av = a.original.keyword_difficulty ?? -1;
          const bv = b.original.keyword_difficulty ?? -1;
          return av - bv;
        },
      },
      {
        accessorKey: "cpc",
        header: "CPC",
        cell: ({ getValue }) => {
          const value = getValue<number>();
          if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
          return <span className="tabular-nums">${value.toFixed(2)}</span>;
        },
      },
      {
        accessorKey: "intent",
        header: "Intent",
        cell: ({ getValue }) => <IntentBadge intent={getValue<string>()} />,
        enableSorting: false,
      },
      {
        id: "trend",
        header: "Trend",
        cell: ({ row }) => (
          <div className="h-8 w-20">
            <Sparkline data={row.original.monthly_searches} height={32} />
          </div>
        ),
        enableSorting: false,
      },
      {
        id: "save",
        header: "",
        cell: ({ row }) => (
          <button
            type="button"
            title="Save to list"
            onClick={(e) => {
              e.stopPropagation();
              setDialogKeywords([row.original.keyword]);
              setDialogOpen(true);
            }}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        ),
        enableSorting: false,
      },
    ],
    [selected, visibleCount]
  );

  const table = useReactTable({
    data: keywords,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const allRows = table.getRowModel().rows;
  const visibleRows = allRows.slice(0, visibleCount);
  const remaining = allRows.length - visibleCount;

  const openBulkSave = () => {
    setDialogKeywords(Array.from(selected));
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Keyword Variations</CardTitle>
        <p className="text-sm text-muted-foreground">
          Related keywords and variations — sort by Volume, KD, or CPC.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {selected.size > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm dark:border-orange-900/40 dark:bg-orange-950/30">
            <span className="text-orange-700 dark:text-orange-400">
              {selected.size} keyword{selected.size === 1 ? "" : "s"} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelected(new Set())}
                className="border-orange-500/40 text-orange-700 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-950/50"
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={openBulkSave}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Bookmark className="mr-1.5 h-3.5 w-3.5" />
                Save {selected.size} to list
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <VariationsSkeleton />
        ) : keywords.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No keyword variations found
          </div>
        ) : (
          <>
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
                  {visibleRows.map((row) => (
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
            {remaining > 0 && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleCount((c) => c + ROW_STEP)}
                >
                  Show {Math.min(ROW_STEP, remaining)} more
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <SaveToListDialog
        keywords={dialogKeywords}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            // If the bulk-save dialog just closed after a successful save, clear selection
            setSelected(new Set());
          }
        }}
      />
    </Card>
  );
}

function VariationsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
