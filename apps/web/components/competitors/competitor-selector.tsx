"use client";

import { cn } from "@/lib/utils";

interface Competitor {
  id: string;
  domain: string;
}

interface Props {
  competitors: Competitor[];
  selected: string;
  onSelect: (domain: string) => void;
}

export function CompetitorSelector({ competitors, selected, onSelect }: Props) {
  if (competitors.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {competitors.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.domain)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            selected === c.domain
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://www.google.com/s2/favicons?domain=${c.domain}&sz=16`}
            alt=""
            className="h-3.5 w-3.5 rounded-sm"
          />
          {c.domain}
        </button>
      ))}
    </div>
  );
}
