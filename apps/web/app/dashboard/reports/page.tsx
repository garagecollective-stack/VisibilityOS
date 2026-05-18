"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { GenerateReportDialog } from "@/components/reports/generate-report-dialog";
import { ReportCard, type ReportSummary } from "@/components/reports/report-card";
import { PageHeader } from "@/components/shared/page-header";
import { apiClient } from "@/lib/api";

interface Project {
  id: string;
  name: string;
  domain: string;
  gscConnected?: boolean;
}

export default function ReportsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ projects: Project[] }>("/projects", { token: token ?? undefined });
    },
  });

  const projects = projectsQuery.data?.projects ?? [];

  // Seed selection once projects load
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0]!.id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const reportsQuery = useQuery({
    queryKey: ["reports", selectedProjectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ reports: ReportSummary[] }>(`/reports/projects/${selectedProjectId}`, {
        token: token ?? undefined,
      });
    },
    enabled: !!selectedProjectId,
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasGenerating = data?.reports.some(
        (r) => r.status === "generating" || r.status === "pending"
      );
      return hasGenerating ? 3000 : false;
    },
  });

  const reports = reportsQuery.data?.reports ?? [];

  const generateMutation = useMutation({
    mutationFn: async (payload: {
      projectId: string;
      title: string;
      type: "full_seo" | "keyword_report" | "audit_report" | "custom";
      sections: string[];
      dateRange: string;
    }) => {
      const token = await getToken();
      return apiClient<{ reportId: string }>("/reports/generate", {
        method: "POST",
        body: JSON.stringify(payload),
        token: token ?? undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reports", selectedProjectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const token = await getToken();
      return apiClient(`/reports/${reportId}`, { method: "DELETE", token: token ?? undefined });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reports", selectedProjectId] });
    },
  });

  const isLoading = projectsQuery.isLoading;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <PageHeader
        title="Reports"
        description="Generate PDF-ready SEO reports combining audit, keyword, and GSC data."
        action={
          <Button onClick={() => setDialogOpen(true)} disabled={projects.length === 0}>
            <Plus className="mr-1.5 h-4 w-4" />
            Generate Report
          </Button>
        }
      />

      {/* Project selector */}
      {!isLoading && projects.length > 1 && (
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-64">
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

      {/* Loading */}
      {(isLoading || reportsQuery.isLoading) && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !reportsQuery.isLoading && reports.length === 0 && !!selectedProjectId && (
        <div className="rounded-lg border border-dashed flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-base font-semibold">No reports generated yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Generate your first report to share SEO performance with your clients.
          </p>
          <Button className="mt-5" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Generate Report
          </Button>
        </div>
      )}

      {/* Reports list */}
      {!isLoading && reports.length > 0 && (
        <div className="space-y-3">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onDelete={(id) => deleteMutation.mutate(id)}
              onView={(id) => router.push(`/dashboard/reports/${id}`)}
            />
          ))}
        </div>
      )}

      {/* Generate dialog */}
      <GenerateReportDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        projects={projects}
        defaultProjectId={selectedProjectId}
        onGenerated={() => {
          void queryClient.invalidateQueries({ queryKey: ["reports", selectedProjectId] });
        }}
        generateFn={(payload) => generateMutation.mutateAsync(payload)}
      />
    </div>
  );
}
