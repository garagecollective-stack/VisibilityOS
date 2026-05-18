"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ENGINE_CONFIG, type GeoPrompt, type GeoResult, type GeoPlatform } from "@/lib/geo";

interface Props {
  prompt: GeoPrompt | null;
  results: GeoResult[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function PromptDetailDialog({ prompt, results, open, onOpenChange }: Props) {
  if (!prompt) return null;

  const promptResults = results.filter((r) => r.promptId === prompt.id);
  const byPlatform = new Map<GeoPlatform, GeoResult>();
  for (const r of [...promptResults].sort(
    (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
  )) {
    if (!byPlatform.has(r.platform)) byPlatform.set(r.platform, r);
  }

  const cited = Array.from(byPlatform.values()).filter((r) => r.cited).length;
  const total = byPlatform.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="leading-snug pr-8">Prompt Detail</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium leading-relaxed">&ldquo;{prompt.promptText}&rdquo;</p>
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                Cited by{" "}
                <span className="font-semibold text-foreground">
                  {cited}/{total}
                </span>{" "}
                engine{total !== 1 ? "s" : ""}
              </span>
              <span>·</span>
              <span>
                {prompt.platforms.length} engine{prompt.platforms.length !== 1 ? "s" : ""} monitored
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Engine Results</h3>
            {prompt.platforms.map((platform) => {
              const result = byPlatform.get(platform);
              const cfg = ENGINE_CONFIG[platform];

              return (
                <div
                  key={platform}
                  className={cn(
                    "rounded-xl border p-4 space-y-3",
                    result?.cited
                      ? cfg.cardBg
                      : "border-border bg-muted/20"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {result?.cited ? (
                        <CheckCircle2 className={cn("h-4 w-4", cfg.textColor)} />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          result?.cited ? cfg.textColor : "text-foreground"
                        )}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {result ? (
                        <>
                          <Badge variant={result.cited ? "success" : "secondary"}>
                            {result.cited ? "Cited" : "Not cited"}
                          </Badge>
                          {result.cited && result.citationPosition !== null && (
                            <Badge variant="outline" className="text-xs">
                              Position #{result.citationPosition}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <Badge variant="secondary">Not checked</Badge>
                      )}
                    </div>
                  </div>

                  {result?.responseText && (
                    <div className="rounded-md bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                        {result.responseText}
                      </p>
                    </div>
                  )}

                  {result && (
                    <p className="text-[11px] text-muted-foreground">
                      Checked{" "}
                      {new Date(result.checkedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
