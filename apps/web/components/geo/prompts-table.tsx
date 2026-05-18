"use client";

import { useMemo, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Eye, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/lib/api";
import {
  ENGINE_CONFIG,
  getPromptStats,
  type GeoPrompt,
  type GeoResult,
} from "@/lib/geo";

interface RowData {
  prompt: GeoPrompt;
  cited: number;
  total: number;
  rate: number;
  lastChecked: string | null;
}

interface Props {
  prompts: GeoPrompt[];
  results: GeoResult[];
  projectId: string;
  isSample?: boolean;
  onViewPrompt: (prompt: GeoPrompt) => void;
}

// Column definitions have no dependency on component state so they can live
// outside the component, keeping useReactTable's columns reference stable.
// The action column reads from refs that are updated each render.
function buildColumns(
  isSample: boolean | undefined,
  onViewPrompt: (prompt: GeoPrompt) => void,
  checkingIdsRef: React.MutableRefObject<Set<string>>,
  mutateRef: React.MutableRefObject<(id: string) => void>
): ColumnDef<RowData>[] {
  return [
    {
      id: "prompt",
      header: "Prompt",
      cell: ({ row }) => (
        <div className="max-w-sm">
          <p
            className="text-sm font-medium truncate"
            title={row.original.prompt.promptText}
          >
            {row.original.prompt.promptText}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {row.original.prompt.platforms.map((p) => (
              <span
                key={p}
                className="inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
              >
                {ENGINE_CONFIG[p].label}
              </span>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "rate",
      header: "Citation Rate",
      cell: ({ row }) => {
        const { cited, total, rate } = row.original;
        if (total === 0) {
          return (
            <span className="text-xs text-muted-foreground">Not checked</span>
          );
        }
        return (
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${rate}%` }}
              />
            </div>
            <span className="text-sm tabular-nums font-medium">{rate}%</span>
            <span className="text-xs text-muted-foreground">
              ({cited}/{total})
            </span>
          </div>
        );
      },
    },
    {
      id: "lastChecked",
      header: "Last Checked",
      cell: ({ row }) => {
        const { lastChecked } = row.original;
        if (!lastChecked) {
          return (
            <span className="text-xs text-muted-foreground">Never</span>
          );
        }
        const diff = Date.now() - new Date(lastChecked).getTime();
        const hours = Math.floor(diff / 3_600_000);
        const days = Math.floor(diff / 86_400_000);
        const label =
          hours < 1 ? "Just now" : hours < 24 ? `${hours}h ago` : `${days}d ago`;
        return (
          <span className="text-sm text-muted-foreground">{label}</span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const promptId = row.original.prompt.id;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => onViewPrompt(row.original.prompt)}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {!isSample && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => mutateRef.current(promptId)}
                disabled={checkingIdsRef.current.has(promptId)}
                title="Run check now"
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];
}

export function PromptsTable({
  prompts,
  results,
  projectId,
  isSample,
  onViewPrompt,
}: Props) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const checkingIdsRef = useRef<Set<string>>(new Set());

  const checkMutation = useMutation({
    mutationFn: async (promptId: string) => {
      const token = await getToken();
      return apiClient(
        `/geo/projects/${projectId}/prompts/${promptId}/check`,
        { method: "POST", token: token ?? undefined }
      );
    },
    onMutate: (promptId) => {
      checkingIdsRef.current = new Set([...checkingIdsRef.current, promptId]);
    },
    onSettled: (_, __, promptId) => {
      const next = new Set(checkingIdsRef.current);
      next.delete(promptId);
      checkingIdsRef.current = next;
    },
    onSuccess: () => {
      toast.success("GEO check queued — results will appear shortly.");
      queryClient.invalidateQueries({ queryKey: ["geo-results", projectId] });
    },
    onError: () => toast.error("Failed to queue check."),
  });

  // Keep a ref to mutate so column definitions don't need to change when the
  // mutation object is recreated by TanStack Query on re-renders.
  const mutateRef = useRef<(id: string) => void>(checkMutation.mutate);
  mutateRef.current = checkMutation.mutate;

  // Columns are built once per component lifetime (stable isSample/onViewPrompt).
  // The action cells read mutate/checkingIds through refs, so they always see
  // the latest values without forcing a column rebuild on every render.
  const columns = useMemo(
    () => buildColumns(isSample, onViewPrompt, checkingIdsRef, mutateRef),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSample, onViewPrompt]
  );

  // Memoize row data so TanStack Table doesn't see new row objects on every
  // parent re-render when prompts/results haven't actually changed.
  const rows = useMemo<RowData[]>(
    () =>
      prompts.map((prompt) => {
        const stats = getPromptStats(prompt.id, prompt.platforms, results);
        return { prompt, ...stats };
      }),
    [prompts, results]
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
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
                className="py-10 text-center text-sm text-muted-foreground"
              >
                No prompts yet.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => onViewPrompt(row.original.prompt)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    onClick={
                      cell.column.id === "actions"
                        ? (e) => e.stopPropagation()
                        : undefined
                    }
                  >
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
