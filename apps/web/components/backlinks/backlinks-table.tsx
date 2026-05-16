"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type { BacklinksData, BacklinkRow } from "./types";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Download, ChevronLeft, ChevronRight } from "lucide-react";

function truncUrl(url: string, n = 38) {
  const stripped = url.replace(/^https?:\/\//, "");
  return stripped.length > n ? stripped.slice(0, n) + "…" : stripped;
}

function DomainRankBadge({ rank }: { rank: number }) {
  const cls =
    rank >= 70 ? "bg-green-50 text-green-700" :
    rank >= 40 ? "bg-orange-50 text-orange-700" :
    "bg-red-50 text-red-700";
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold tabular-nums ${cls}`}>
      {rank}
    </span>
  );
}

function StatusBadge({ status }: { status: BacklinkRow["status"] }) {
  const map: Record<BacklinkRow["status"], string> = {
    active: "bg-green-50 text-green-700 border-green-200",
    lost: "bg-red-50 text-red-700 border-red-200",
    new: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <Badge variant="outline" className={`text-xs ${map[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function fmtDate(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

const columns: ColumnDef<BacklinkRow>[] = [
  {
    accessorKey: "sourceUrl",
    header: "Source URL",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5 min-w-[180px]">
        <img
          src={`https://www.google.com/s2/favicons?domain=${row.original.sourceDomain}&sz=16`}
          alt=""
          width={14}
          height={14}
          className="rounded-sm shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <a
          href={row.original.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs hover:underline truncate max-w-[200px]"
          title={row.original.sourceUrl}
        >
          {truncUrl(row.original.sourceUrl)}
        </a>
        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
      </div>
    ),
  },
  {
    accessorKey: "targetUrl",
    header: "Target URL",
    cell: ({ row }) => (
      <span
        className="text-xs text-muted-foreground max-w-[160px] block truncate"
        title={row.original.targetUrl}
      >
        {truncUrl(row.original.targetUrl, 32)}
      </span>
    ),
  },
  {
    accessorKey: "anchor",
    header: "Anchor",
    cell: ({ row }) => (
      <span className="text-xs italic text-muted-foreground">{row.original.anchor || "(empty)"}</span>
    ),
  },
  {
    accessorKey: "domainRank",
    header: "DR",
    cell: ({ row }) => <DomainRankBadge rank={row.original.domainRank} />,
  },
  {
    accessorKey: "firstSeen",
    header: "First Seen",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {fmtDate(row.original.firstSeen)}
      </span>
    ),
  },
  {
    accessorKey: "dofollow",
    header: "Link",
    cell: ({ row }) => (
      <Badge variant={row.original.dofollow ? "default" : "secondary"} className="text-xs">
        {row.original.dofollow ? "Follow" : "Nofollow"}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

function exportCsv(rows: BacklinkRow[]) {
  const header = ["Source URL", "Target URL", "Anchor", "Domain Rank", "First Seen", "Follow", "Status"];
  const lines = rows.map((r) =>
    [r.sourceUrl, r.targetUrl, r.anchor, r.domainRank, r.firstSeen, r.dofollow ? "follow" : "nofollow", r.status]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "backlinks.csv";
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  projectId: string;
}

export function BacklinksTable({ projectId }: Props) {
  const { getToken } = useAuth();
  const [search, setSearch] = useState("");
  const [followFilter, setFollowFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "domainRank", desc: true }]);

  const { data, isLoading } = useQuery({
    queryKey: ["backlinks-list", projectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<BacklinksData>(`/backlinks/projects/${projectId}/backlinks`, {
        token: token ?? undefined,
      });
    },
    enabled: !!projectId,
  });

  const filtered = useMemo(() => {
    let rows = data?.backlinks ?? [];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.sourceDomain.includes(q) ||
          r.sourceUrl.includes(q) ||
          r.anchor.toLowerCase().includes(q)
      );
    }
    if (followFilter !== "all") {
      rows = rows.filter((r) => (followFilter === "follow" ? r.dofollow : !r.dofollow));
    }
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    return rows;
  }, [data, search, followFilter, statusFilter]);

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

  return (
    <Card className="card-shadow">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">All Backlinks</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search domain or anchor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-52 text-sm"
            />
            <Select value={followFilter} onValueChange={setFollowFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Links</SelectItem>
                <SelectItem value="follow">Follow</SelectItem>
                <SelectItem value="nofollow">Nofollow</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="new">New</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => exportCsv(filtered)}
              disabled={filtered.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {hg.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className="cursor-pointer select-none whitespace-nowrap"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="text-center text-sm text-muted-foreground py-10"
                      >
                        No backlinks match the current filters.
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

            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-muted-foreground">
                {filtered.length} backlink{filtered.length !== 1 ? "s" : ""}
                {data?.isSampleData ? " · sample data" : ""}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs tabular-nums">
                  {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
