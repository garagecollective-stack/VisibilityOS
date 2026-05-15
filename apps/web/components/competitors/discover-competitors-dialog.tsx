"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMetric } from "@/lib/keywords";
import { cn } from "@/lib/utils";

interface SuggestedCompetitor {
  domain: string;
  sharedKeywords: number;
  traffic: number;
  avgPosition: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  yourDomain: string;
  suggestions: SuggestedCompetitor[];
  loading: boolean;
  onAdd: (domains: string[]) => Promise<void>;
  isMock?: boolean;
}

export function DiscoverCompetitorsDialog({
  open,
  onOpenChange,
  yourDomain,
  suggestions,
  loading,
  onAdd,
  isMock,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  function toggle(domain: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setAdding(true);
    try {
      await onAdd(Array.from(selected));
      setSelected(new Set());
      onOpenChange(false);
    } finally {
      setAdding(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Suggested Competitors
          </DialogTitle>
          <DialogDescription>
            Based on keyword overlap with <strong>{yourDomain}</strong>
            {isMock && (
              <span className="ml-2 text-orange-600 font-medium">(sample data)</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-5 rounded-sm" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No suggestions found. Try adding competitors manually.
            </p>
          ) : (
            <>
              {/* Header row */}
              <div className="grid grid-cols-[auto_1fr_80px_80px_80px] gap-2 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground border-b">
                <div className="w-4" />
                <div>Domain</div>
                <div className="text-right">Shared KW</div>
                <div className="text-right">Traffic</div>
                <div className="text-right">Avg Pos</div>
              </div>

              {suggestions.map((s) => (
                <label
                  key={s.domain}
                  className={cn(
                    "grid grid-cols-[auto_1fr_80px_80px_80px] gap-2 items-center px-3 py-2.5 rounded-md cursor-pointer transition-colors",
                    selected.has(s.domain)
                      ? "bg-primary/5 ring-1 ring-primary/20"
                      : "hover:bg-muted/50"
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary cursor-pointer"
                    checked={selected.has(s.domain)}
                    onChange={() => toggle(s.domain)}
                  />
                  <div className="flex items-center gap-2 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=16`}
                      alt=""
                      className="h-4 w-4 rounded-sm shrink-0"
                    />
                    <span className="text-sm font-medium truncate">{s.domain}</span>
                  </div>
                  <div className="text-right text-sm tabular-nums text-muted-foreground">
                    {formatMetric(s.sharedKeywords)}
                  </div>
                  <div className="text-right text-sm tabular-nums text-muted-foreground">
                    {formatMetric(s.traffic)}
                  </div>
                  <div className="text-right text-sm tabular-nums text-muted-foreground">
                    {s.avgPosition.toFixed(1)}
                  </div>
                </label>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
          </button>
          <Button
            onClick={handleAdd}
            disabled={selected.size === 0 || adding}
            className="min-w-[120px]"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Add ${selected.size > 0 ? selected.size + " Selected" : "Selected"}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
