"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const MESSAGES = [
  "Analyzing your topic...",
  "Identifying pillar keywords...",
  "Mapping content clusters...",
  "Finding quick win opportunities...",
  "Generating content calendar...",
];

export function StrategyLoading() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % MESSAGES.length), 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="overflow-hidden border-purple-200 bg-gradient-to-br from-purple-50 via-blue-50 to-orange-50 dark:border-purple-900/40 dark:from-purple-950/30 dark:via-blue-950/30 dark:to-orange-950/30">
      <CardContent className="flex flex-col items-center gap-5 py-14 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-purple-500/30" />
          <span className="absolute inset-2 animate-pulse rounded-full bg-purple-500/20" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg">
            <Sparkles className="h-7 w-7 animate-pulse" />
          </span>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold">Building your keyword strategy…</h3>
          <p className="min-h-[1.25rem] text-sm text-muted-foreground transition-opacity">
            {MESSAGES[index]}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
