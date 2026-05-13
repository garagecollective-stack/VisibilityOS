"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileSearch,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { downloadCsv } from "@/lib/keywords";
import { cn } from "@/lib/utils";

export interface CrawledPage {
  url: string;
  status_code: number;
  title: string | null;
  has_meta_desc: boolean;
  has_h1: boolean;
  word_count: number;
  is_https: boolean;
  issues_count: number;
}

type StatusBucket = "all" | "2xx" | "3xx" | "4xx" | "5xx";

interface Props {
  pages: CrawledPage[];
}

export function CrawledPagesTable({ pages }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusBucket, setStatusBucket] = useState<StatusBucket>("all");

  const filtered = useMemo(() => {
    if (statusBucket === "all") return pages;
    return pages.filter((p) => {
      const code = p.status_code;
      if (statusBucket === "2xx") return code >= 200 && code < 300;
      if (statusBucket === "3xx") return code >= 300 && code < 400;
      if (statusBucket === "4xx") return code >= 400 && code < 500;
      if (statusBucket === "5xx") return code >= 500;
      return true;
    });
  }, [pages, statusBucket]);

  const columns = useMemo<ColumnDef<CrawledPage>[]>(
    () => [
      {
        accessorKey: "url",
        header: "URL",
        cell: ({ getValue }) => {
          const url = getValue<string>();
          return (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-[280px] items-center gap-1 truncate text-xs text-primary hover:underline"
                  >
                    <span className="truncate">{url}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </TooltipTrigger>
                <TooltipContent className="max-w-md break-all">{url}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: "status_code",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge code={getValue<number>()} />,
        sortingFn: "basic",
      },
      {
        id: "title_present",
        accessorFn: (row) => (row.title && row.title.trim().length > 0 ? 1 : 0),
        header: "Title",
        cell: ({ row }) => <CheckCell present={!!row.original.title?.trim()} />,
      },
      {
        accessorKey: "has_meta_desc",
        header: "Meta",
        cell: ({ getValue }) => <CheckCell present={getValue<boolean>()} />,
      },
      {
        accessorKey: "has_h1",
        header: "H1",
        cell: ({ getValue }) => <CheckCell present={getValue<boolean>()} />,
      },
      {
        accessorKey: "word_count",
        header: "Words",
        cell: ({ getValue }) => {
          const n = getValue<number>();
          return (
            <span
              className={cn(
                "tabular-nums",
                n < 300 && n > 0 && "font-semibold text-red-600 dark:text-red-400"
              )}
            >
              {n.toLocaleString()}
            </span>
          );
        },
        sortingFn: "basic",
      },
      {
        accessorKey: "issues_count",
        header: "Issues",
        cell: ({ getValue }) => {
          const n = getValue<number>();
          if (n === 0)
            return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {n}
            </span>
          );
        },
        sortingFn: "basic",
      },
    ],
    []
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: "includesString",
    initialState: { pagination: { pageSize: 25 } },
  });

  const handleExport = () => {
    const rows: string[][] = [
      ["URL", "Status Code", "Title", "Has Meta Description", "Has H1", "Word Count", "HTTPS", "Issues"],
      ...pages.map((p) => [
        p.url,
        String(p.status_code),
        p.title ?? "",
        p.has_meta_desc ? "yes" : "no",
        p.has_h1 ? "yes" : "no",
        String(p.word_count),
        p.is_https ? "yes" : "no",
        String(p.issues_count),
      ]),
    ];
    downloadCsv("crawled-pages.csv", rows);
  };

  if (pages.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Crawled Pages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed py-10 text-center">
            <FileSearch className="h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium">Page-level data not available for this audit</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Run a new audit to see crawled pages with per-URL details.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pageInfo = table.getState().pagination;
  const totalPages = table.getPageCount();
  const totalRows = table.getFilteredRowModel().rows.length;
  const startRow = totalRows === 0 ? 0 : pageInfo.pageIndex * pageInfo.pageSize + 1;
  const endRow = Math.min(totalRows, (pageInfo.pageIndex + 1) * pageInfo.pageSize);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Crawled Pages</CardTitle>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
            {pages.length}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter URLs…"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <div className="w-full sm:w-44">
            <Select value={statusBucket} onValueChange={(v) => setStatusBucket(v as StatusBucket)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="2xx">2xx (Success)</SelectItem>
                <SelectItem value="3xx">3xx (Redirect)</SelectItem>
                <SelectItem value="4xx">4xx (Client error)</SelectItem>
                <SelectItem value="5xx">5xx (Server error)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

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
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
                    No pages match the current filter.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-medium tabular-nums">{startRow}</span>–
            <span className="font-medium tabular-nums">{endRow}</span> of{" "}
            <span className="font-medium tabular-nums">{totalRows}</span>
            {totalRows !== pages.length && ` (filtered from ${pages.length.toLocaleString()})`}
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

function StatusBadge({ code }: { code: number }) {
  let cls: string;
  let label: string;
  if (code >= 200 && code < 300) {
    cls = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    label = `${code} OK`;
  } else if (code >= 300 && code < 400) {
    cls = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    label = `${code} Redirect`;
  } else if (code === 404) {
    cls = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    label = "404 Not Found";
  } else if (code >= 500) {
    cls = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    label = `${code} Error`;
  } else if (code >= 400) {
    cls = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    label = `${code}`;
  } else {
    cls = "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    label = String(code);
  }
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", cls)}>
      {label}
    </span>
  );
}

function CheckCell({ present }: { present: boolean }) {
  return present ? (
    <CheckCircle2 className="h-4 w-4 text-green-500" />
  ) : (
    <XCircle className="h-4 w-4 text-red-500" />
  );
}
