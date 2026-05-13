"use client";

import { Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircularScore, scoreLabel } from "@/components/shared/circular-score";
import { MiniProgress } from "@/components/shared/mini-progress";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";

interface Props {
  domain: string;
  countryCode: string;
  technicalScore: number | null;
  keywordsScore: number | null;
  backlinksScore: number | null;
}

function overall(
  technicalScore: number | null,
  keywordsScore: number | null,
  backlinksScore: number | null
): number | null {
  const values = [technicalScore, keywordsScore, backlinksScore].filter(
    (v): v is number => v !== null
  );
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function ProjectHealthCard({
  domain,
  countryCode,
  technicalScore,
  keywordsScore,
  backlinksScore,
}: Props) {
  const score = overall(technicalScore, keywordsScore, backlinksScore);
  const sampleSubScore = keywordsScore === null || backlinksScore === null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">Project Health</CardTitle>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{domain}</span>
              <span className="text-muted-foreground/70">· {countryCode}</span>
            </div>
          </div>
          {sampleSubScore && <SampleDataBadge />}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-4">
          <CircularScore score={score} size={84} thickness={9} />
          <div>
            <p className="text-2xl font-bold tabular-nums">{score ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{scoreLabel(score)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Overall SEO health</p>
          </div>
        </div>
        <div className="space-y-3">
          <MiniProgress label="Technical" value={technicalScore} />
          <MiniProgress label="Keywords" value={keywordsScore ?? 64} />
          <MiniProgress label="Backlinks" value={backlinksScore ?? 51} />
        </div>
      </CardContent>
    </Card>
  );
}
