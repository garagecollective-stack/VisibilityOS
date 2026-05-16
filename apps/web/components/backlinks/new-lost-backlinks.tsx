"use client";

import type { OverviewData, BacklinkListItem } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";

function getDomain(url: string) {
  try { return new URL(url).hostname; }
  catch { return url; }
}

function BacklinkRow({ item }: { item: BacklinkListItem }) {
  const domain = getDomain(item.sourceUrl);
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <img
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
            alt=""
            width={14}
            height={14}
            className="rounded-sm shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium truncate max-w-[180px] hover:underline"
          >
            {domain}
          </a>
          <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[220px] italic">
          {item.anchor}
        </p>
      </div>
      <div className="shrink-0 text-right ml-4">
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">DR {item.domainRank}</span>
        <p className="text-[10px] text-muted-foreground mt-0.5">{item.date}</p>
      </div>
    </div>
  );
}

interface Props {
  data: OverviewData | null;
  isLoading: boolean;
}

export function NewLostBacklinks({ data, isLoading }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* New backlinks */}
      <Card className="card-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">New Backlinks</CardTitle>
            {data && (
              <span className="text-xs font-semibold text-green-700 bg-green-50 rounded-full px-2 py-0.5">
                +{data.newBacklinks30d} this month
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading || !data ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div>
              {data.newBacklinksList.map((item, i) => (
                <BacklinkRow key={i} item={item} />
              ))}
              {data.newBacklinksList.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No new backlinks this month.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lost backlinks */}
      <Card className="card-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Lost Backlinks</CardTitle>
            {data && (
              <span className="text-xs font-semibold text-red-700 bg-red-50 rounded-full px-2 py-0.5">
                -{data.lostBacklinks30d} this month
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading || !data ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div>
              {data.lostBacklinksList.map((item, i) => (
                <BacklinkRow key={i} item={item} />
              ))}
              {data.lostBacklinksList.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No lost backlinks this month.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
