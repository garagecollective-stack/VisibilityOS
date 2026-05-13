"use client";

import { ExternalLink, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { cn } from "@/lib/utils";

export interface TopPage {
  url: string;
  position: number;
  kwCount: number;
}

const SAMPLE_PAGES: TopPage[] = [
  { url: "https://example.com/", position: 3, kwCount: 18 },
  { url: "https://example.com/blog/seo-guide", position: 5, kwCount: 12 },
  { url: "https://example.com/pricing", position: 8, kwCount: 9 },
  { url: "https://example.com/features", position: 11, kwCount: 7 },
  { url: "https://example.com/blog/tools", position: 14, kwCount: 5 },
];

function ctr(position: number): number {
  if (position <= 1) return 0.28;
  if (position <= 2) return 0.15;
  if (position <= 3) return 0.11;
  if (position <= 10) return 0.06;
  if (position <= 20) return 0.02;
  return 0.005;
}

function positionColor(position: number): string {
  if (position <= 3) return "text-green-600 dark:text-green-400";
  if (position <= 10) return "text-blue-600 dark:text-blue-400";
  if (position <= 20) return "text-yellow-600 dark:text-yellow-400";
  return "text-muted-foreground";
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname : u.pathname;
  } catch {
    return url;
  }
}

interface Props {
  pages: TopPage[];
  isSample?: boolean;
}

export function TopPagesCard({ pages, isSample = false }: Props) {
  const rows = isSample || pages.length === 0 ? SAMPLE_PAGES : pages;
  const showSample = isSample || pages.length === 0;

  const maxTraffic = Math.max(...rows.map((p) => Math.round(p.kwCount * ctr(p.position) * 100)));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Top Pages by Traffic</CardTitle>
        </div>
        {showSample && <SampleDataBadge />}
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((page, i) => {
          const trafficScore = Math.round(page.kwCount * ctr(page.position) * 100);
          const barPct = maxTraffic > 0 ? (trafficScore / maxTraffic) * 100 : 0;
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <a
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 flex-1 items-center gap-1 text-xs text-primary hover:underline"
                >
                  <span className="truncate">{shortenUrl(page.url)}</span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <span className={cn("tabular-nums font-semibold", positionColor(page.position))}>
                    #{page.position}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{page.kwCount} kw</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-[width] duration-500"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <span className="w-16 text-right text-[10px] tabular-nums text-muted-foreground">
                  ~{trafficScore} est.
                </span>
              </div>
            </div>
          );
        })}
        <p className="text-[10px] text-muted-foreground">
          Est. traffic = keywords × position CTR. Relative score, not absolute clicks.
        </p>
      </CardContent>
    </Card>
  );
}
