"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  domain: string;
  startedAt: string;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function CrawlingIndicator({ domain, startedAt }: Props) {
  const [elapsedMs, setElapsedMs] = useState(() => Date.now() - new Date(startedAt).getTime());

  useEffect(() => {
    const startMs = new Date(startedAt).getTime();
    const id = setInterval(() => setElapsedMs(Date.now() - startMs), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
            <span className="absolute inset-2 animate-pulse rounded-full bg-primary/20" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Search className="h-7 w-7" />
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <h3 className="text-lg font-semibold">Crawling your site…</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                Running
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Analyzing pages and checking SEO rules
            </p>
            <p className="text-xs text-muted-foreground">
              {domain} · Time elapsed: <span className="font-mono font-medium tabular-nums">{formatElapsed(elapsedMs)}</span>
            </p>
          </div>
        </div>

        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-primary animate-crawler-progress" />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          This page refreshes automatically. You can leave and come back — the audit will keep running.
        </p>
      </CardContent>
    </Card>
  );
}
