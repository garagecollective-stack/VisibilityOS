"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import { ALL_PLATFORMS, ENGINE_CONFIG, type GeoPrompt } from "@/lib/geo";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AddPromptDialog({ projectId, open, onOpenChange }: Props) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([
    "chatgpt",
    "perplexity",
    "gemini",
  ]);

  const toggle = (p: string) =>
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );

  const mutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return apiClient<{ prompt: GeoPrompt }>(`/geo/projects/${projectId}/prompts`, {
        method: "POST",
        body: JSON.stringify({ promptText: text.trim(), platforms }),
        token: token ?? undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geo-prompts", projectId] });
      setText("");
      setPlatforms(["chatgpt", "perplexity", "gemini"]);
      onOpenChange(false);
    },
  });

  const handleClose = (v: boolean) => {
    if (!v) {
      setText("");
      setPlatforms(["chatgpt", "perplexity", "gemini"]);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add GEO Prompt</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label htmlFor="prompt-text">Prompt</Label>
            <Textarea
              id="prompt-text"
              placeholder="What is the best CRM for small businesses?"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              A natural-language question your potential customers might ask an AI engine. Min 10 characters.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Check on engines</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_PLATFORMS.map((p) => (
                <label
                  key={p}
                  className="flex items-center gap-2 cursor-pointer rounded-md border border-border px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={platforms.includes(p)}
                    onCheckedChange={() => toggle(p)}
                  />
                  <span className="text-sm font-medium">{ENGINE_CONFIG[p].label}</span>
                </label>
              ))}
            </div>
          </div>

          {mutation.isError && (
            <p className="text-sm text-destructive">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Failed to add prompt."}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={
                text.trim().length < 10 ||
                platforms.length === 0 ||
                mutation.isPending
              }
            >
              {mutation.isPending ? "Adding..." : "Add Prompt"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
