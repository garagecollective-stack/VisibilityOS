"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { OverviewData, HistoryData, AnchorsData, ReferringDomainsData } from "@/components/backlinks/types";
import { OverviewCards } from "@/components/backlinks/overview-cards";
import { BacklinkGrowthChart } from "@/components/backlinks/backlink-growth-chart";
import { AnchorTextChart } from "@/components/backlinks/anchor-text-chart";
import { ReferringDomainsTable } from "@/components/backlinks/referring-domains-table";
import { NewLostBacklinks } from "@/components/backlinks/new-lost-backlinks";
import { BacklinksTable } from "@/components/backlinks/backlinks-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Project {
  id: string;
  name: string;
  domain: string;
}

export default function BacklinksPage() {
  const { getToken } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ projects: Project[] }>("/projects", { token: token ?? undefined });
    },
  });

  const projects = projectsQuery.data?.projects ?? [];

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0]!.id);
    }
  }, [projects, selectedProjectId]);

  const overviewQuery = useQuery({
    queryKey: ["backlinks-overview", selectedProjectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<OverviewData>(
        `/backlinks/projects/${selectedProjectId}/overview`,
        { token: token ?? undefined }
      );
    },
    enabled: !!selectedProjectId,
  });

  const historyQuery = useQuery({
    queryKey: ["backlinks-history", selectedProjectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<HistoryData>(
        `/backlinks/projects/${selectedProjectId}/history`,
        { token: token ?? undefined }
      );
    },
    enabled: !!selectedProjectId,
  });

  const anchorsQuery = useQuery({
    queryKey: ["backlinks-anchors", selectedProjectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<AnchorsData>(
        `/backlinks/projects/${selectedProjectId}/anchors`,
        { token: token ?? undefined }
      );
    },
    enabled: !!selectedProjectId,
  });

  const referringDomainsQuery = useQuery({
    queryKey: ["backlinks-referring-domains", selectedProjectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<ReferringDomainsData>(
        `/backlinks/projects/${selectedProjectId}/referring-domains`,
        { token: token ?? undefined }
      );
    },
    enabled: !!selectedProjectId,
  });

  const isSampleData = overviewQuery.data?.isSampleData ?? false;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Backlinks</h1>
            {isSampleData && (
              <Badge
                variant="outline"
                className="bg-orange-50 text-orange-700 border-orange-200 text-xs font-medium"
              >
                Sample Data
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Analyze referring domains, link authority, and anchor text distribution.
          </p>
        </div>

        {!projectsQuery.isLoading && projects.length > 1 && (
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — {p.domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Section 1 — Overview cards */}
      <OverviewCards
        data={overviewQuery.data ?? null}
        isLoading={overviewQuery.isLoading}
      />

      {/* Section 2+3 — Growth chart + Anchor text */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <BacklinkGrowthChart
            data={historyQuery.data ?? null}
            isLoading={historyQuery.isLoading}
          />
        </div>
        <div>
          <AnchorTextChart
            data={anchorsQuery.data ?? null}
            isLoading={anchorsQuery.isLoading}
          />
        </div>
      </div>

      {/* Section 4 — Top referring domains */}
      <ReferringDomainsTable
        data={referringDomainsQuery.data ?? null}
        isLoading={referringDomainsQuery.isLoading}
      />

      {/* Section 5 — New & Lost backlinks */}
      <NewLostBacklinks
        data={overviewQuery.data ?? null}
        isLoading={overviewQuery.isLoading}
      />

      {/* Section 6 — Full backlinks table */}
      <BacklinksTable projectId={selectedProjectId} />
    </div>
  );
}
