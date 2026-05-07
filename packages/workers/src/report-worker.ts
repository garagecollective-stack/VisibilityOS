import { Worker, type Job } from "bullmq";
import type { ReportJobData } from "./queues.js";
import { getRedisConnection } from "./queues.js";
import { reports } from "@garage-seo/db";
import { eq } from "drizzle-orm";

export function createReportWorker(
  db: import("@garage-seo/db").Database,
  storage: { upload: (key: string, buffer: Buffer, mimeType: string) => Promise<string> }
) {
  return new Worker<ReportJobData>(
    "reports",
    async (job: Job<ReportJobData>) => {
      const { reportId, projectId, type } = job.data;

      await db.update(reports).set({ status: "generating" }).where(eq(reports.id, reportId));

      job.log(`Generating ${type} report for project ${projectId}`);

      try {
        // PDF generation placeholder — will be implemented with @react-pdf/renderer
        const pdfBuffer = Buffer.from(`PDF report: ${type} for project ${projectId}`);
        const fileKey = `reports/${projectId}/${reportId}.pdf`;
        const fileUrl = await storage.upload(fileKey, pdfBuffer, "application/pdf");

        await db
          .update(reports)
          .set({ status: "ready", fileUrl })
          .where(eq(reports.id, reportId));

        job.log(`Report ready: ${fileUrl}`);
        return { reportId, fileUrl };
      } catch (err) {
        await db.update(reports).set({ status: "failed" }).where(eq(reports.id, reportId));
        throw err;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );
}
