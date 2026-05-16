"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportPreview } from "@/components/reports/report-preview";
import type { ReportData } from "@/components/reports/types";
import { apiClient } from "@/lib/api";

interface FullReport {
  id: string;
  title: string;
  type: string;
  status: string;
  reportData: ReportData | null;
  project: { id: string; name: string; domain: string };
  createdAt: string;
}

export default function ReportDetailPage({ params }: { params: { reportId: string } }) {
  const { reportId } = params;
  const { getToken } = useAuth();
  const router = useRouter();

  const reportQuery = useQuery({
    queryKey: ["report", reportId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ report: FullReport }>(`/reports/${reportId}`, { token: token ?? undefined });
    },
  });

  const report = reportQuery.data?.report ?? null;

  if (reportQuery.isLoading) {
    return (
      <div className="p-6 max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Report not found.</p>
        <Button variant="ghost" className="mt-2 gap-1" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    );
  }

  return (
    <div id="report-print-root" className="p-6 max-w-4xl">
        {/* Back nav — hidden in print */}
        <div className="print-hide flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Button>
        </div>

        {report.status === "generating" || report.status === "pending" ? (
          <div className="rounded-lg border p-10 text-center">
            <div className="h-2 w-64 mx-auto rounded-full bg-muted overflow-hidden mb-4">
              <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
            <p className="text-sm text-muted-foreground">Generating report… this takes 10–30 seconds.</p>
          </div>
        ) : report.status === "failed" ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
            <p className="font-medium text-destructive">Report generation failed</p>
            <p className="text-sm text-muted-foreground mt-1">Please generate a new report.</p>
          </div>
        ) : report.reportData ? (
          <ReportPreview reportData={report.reportData} showPrintButton />
        ) : (
          <p className="text-muted-foreground">No report data available.</p>
        )}
    </div>
  );
}
