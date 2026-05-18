"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import dynamic from "next/dynamic";
import type { OverviewData, HistoryData, AnchorsData, ReferringDomainsData } from "@/components/backlinks/types";
import { OverviewCards } from "@/components/backlinks/overview-cards";
import { ReferringDomainsTable } from "@/components/backlinks/referring-domains-table";
import { NewLostBacklinks } from "@/components/backlinks/new-lost-backlinks";
import { BacklinksTable } from "@/components/backlinks/backlinks-table";

const BacklinkGrowthChart = dynamic(
  () => import("@/components/backlinks/backlink-growth-chart").then((m) => m.BacklinkGrowthChart),
  { ssr: false }
);
const AnchorTextChart = dynamic(
  () => import("@/components/backlinks/anchor-text-chart").then((m) => m.AnchorTextChart),
  { ssr: false }
);
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";

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
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
  });

  const isSampleData = overviewQuery.data?.isSampleData ?? false;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Backlinks"
        description="Analyze referring domains, link authority, and anchor text distribution."
        action={
          <div className="flex items-center gap-3">
            {isSampleData && (
              <Badge variant="warning">Sample Data</Badge>
            )}
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
        }
      />

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
