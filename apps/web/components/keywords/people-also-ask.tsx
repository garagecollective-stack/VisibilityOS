"use client";

import { useState } from "react";
import { Bookmark, ChevronDown, ChevronRight, ExternalLink, HelpCircle } from "lucide-react";
import { SaveToListDialog } from "@/components/keywords/save-to-list-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface PaaQuestion {
  question: string;
  featured_title?: string;
  featured_url?: string;
}

interface Props {
  questions: PaaQuestion[];
  loading?: boolean;
}

const INITIAL_VISIBLE = 8;

export function PeopleAlsoAsk({ questions, loading }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [dialogKeywords, setDialogKeywords] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">People Also Ask</CardTitle>
          <p className="text-sm text-muted-foreground">
            Questions people search related to this keyword
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) return null;

  const toggle = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const visibleQuestions = questions.slice(0, visibleCount);
  const remaining = questions.length - visibleCount;

  const handleSave = (questionText: string) => {
    setDialogKeywords([questionText]);
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-lg">People Also Ask</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Questions people search related to this keyword
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleQuestions.map((q, index) => {
          const isOpen = expanded.has(index);
          return (
            <div
              key={`${q.question}-${index}`}
              className={cn(
                "overflow-hidden rounded-md border bg-background transition-colors",
                isOpen && "border-primary/40"
              )}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  className="flex flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold">{q.question}</span>
                </button>
                <button
                  type="button"
                  title="Save question to list"
                  onClick={() => handleSave(q.question)}
                  className="mr-2 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Bookmark className="h-4 w-4" />
                </button>
              </div>
              {isOpen && (q.featured_title || q.featured_url) && (
                <div className="space-y-1 border-t bg-muted/20 px-11 py-3">
                  {q.featured_title && (
                    <p className="text-sm text-foreground">{q.featured_title}</p>
                  )}
                  {q.featured_url && (
                    <a
                      href={q.featured_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 break-all text-xs text-primary hover:underline"
                    >
                      <span className="truncate">{q.featured_url}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {remaining > 0 && (
          <div className="flex justify-center pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleCount((c) => c + INITIAL_VISIBLE)}
            >
              Show {Math.min(INITIAL_VISIBLE, remaining)} more
            </Button>
          </div>
        )}
      </CardContent>

      <SaveToListDialog
        keywords={dialogKeywords}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </Card>
  );
}
