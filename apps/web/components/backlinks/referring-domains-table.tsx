"use client";

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type { ReferringDomainsData, ReferringDomain } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

function fmtDate(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
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

const columns: ColumnDef<ReferringDomain>[] = [
  {
    accessorKey: "domain",
    header: "Domain",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <img
          src={`https://www.google.com/s2/favicons?domain=${row.original.domain}&sz=16`}
          alt=""
          width={16}
          height={16}
          className="rounded-sm"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <span className="text-sm font-medium">{row.original.domain}</span>
      </div>
    ),
  },
  {
    accessorKey: "domainRank",
    header: "DR",
    cell: ({ row }) => <DomainRankBadge rank={row.original.domainRank} />,
  },
  {
    accessorKey: "backlinks",
    header: "Backlinks",
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">{row.original.backlinks}</span>
    ),
  },
  {
    accessorKey: "firstSeen",
    header: "First Seen",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{fmtDate(row.original.firstSeen)}</span>
    ),
  },
  {
    accessorKey: "lastSeen",
    header: "Last Seen",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{fmtDate(row.original.lastSeen)}</span>
    ),
  },
  {
    accessorKey: "follow",
    header: "Link Type",
    cell: ({ row }) => (
      <Badge variant={row.original.follow ? "default" : "secondary"} className="text-xs">
        {row.original.follow ? "Follow" : "Nofollow"}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={`text-xs ${
          row.original.status === "active"
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}
      >
        {row.original.status === "active" ? "Active" : "Lost"}
      </Badge>
    ),
  },
];

interface Props {
  data: ReferringDomainsData | null;
  isLoading: boolean;
}

export function ReferringDomainsTable({ data, isLoading }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "domainRank", desc: true }]);

  const table = useReactTable({
    data: data?.domains ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Card className="card-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Top Referring Domains</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        className="cursor-pointer select-none whitespace-nowrap"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : sorted === "desc" ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
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
        )}
      </CardContent>
    </Card>
  );
}
