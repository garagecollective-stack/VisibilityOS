import { Worker, type Job } from "bullmq";
import type { AuditJobData } from "./queues.js";
import { getRedisConnection } from "./queues.js";
import type { OnPageIssue } from "@garage-seo/dataforseo";
import { auditRuns, auditIssues, createId } from "@garage-seo/db";
import { eq } from "drizzle-orm";

export function calculateHealthScore(issues: OnPageIssue[]): number {
  const criticalPenalty = Math.min(issues.filter((i) => i.severity === "critical").length * 5, 40);
  const warningPenalty = Math.min(issues.filter((i) => i.severity === "warning").length * 2, 30);
  const noticePenalty = Math.min(issues.filter((i) => i.severity === "notice").length * 0.5, 15);
  return Math.max(0, 100 - criticalPenalty - warningPenalty - noticePenalty);
}

function mapIssueSeverity(
  severity: string
): "critical" | "warning" | "notice" {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  return "notice";
}

function mapIssueCategory(
  category: string
): "meta" | "links" | "speed" | "content" | "schema" | "mobile" | "security" | "indexing" | "cwv" {
  const cat = category.toLowerCase();
  if (cat.includes("link") || cat.includes("redirect")) return "links";
  if (cat.includes("speed") || cat.includes("performance")) return "speed";
  if (cat.includes("content") || cat.includes("duplicate")) return "content";
  if (cat.includes("schema") || cat.includes("structured")) return "schema";
  if (cat.includes("mobile")) return "mobile";
  if (cat.includes("security") || cat.includes("ssl")) return "security";
  if (cat.includes("index") || cat.includes("robot") || cat.includes("canonical")) return "indexing";
  if (cat.includes("cwv") || cat.includes("core web")) return "cwv";
  return "meta";
}

export function createAuditWorker(
  dataforSEO: import("@garage-seo/dataforseo").DataForSEO,
  db: import("@garage-seo/db").Database
) {
  return new Worker<AuditJobData>(
    "audits",
    async (job: Job<AuditJobData>) => {
      const { projectId, auditRunId, domain, maxPages = 500 } = job.data;


      // 1. Mark running
      await db
        .update(auditRuns)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(auditRuns.id, auditRunId));

      job.log(`Starting OnPage crawl for ${domain}`);

      try {
        // 2. Start crawl
        const taskId = await dataforSEO.onpage.startCrawl(domain, maxPages, true);

        // 3. Poll for completion (10 min timeout)
        await dataforSEO.onpage.waitForTask(taskId, 10 * 60 * 1000);

        job.log(`Crawl complete for task ${taskId}, fetching issues...`);

        // 4. Fetch results
        const issues = await dataforSEO.onpage.getIssues(taskId);
        const pages = await dataforSEO.onpage.getCrawlResults(taskId);

        // 5. Calculate score
        const healthScore = calculateHealthScore(issues);
        const critical = issues.filter((i) => i.severity === "critical").length;
        const warnings = issues.filter((i) => i.severity === "warning").length;
        const notices = issues.filter((i) => i.severity === "notice").length;

        // 6. Bulk insert issues
        if (issues.length > 0) {
          await db.insert(auditIssues).values(
            issues.map((issue) => ({
              id: createId(),
              runId: auditRunId,
              severity: mapIssueSeverity(issue.severity),
              category: mapIssueCategory(issue.category),
              url: null,
              title: issue.title,
              description: issue.description,
              recommendation: "",
              affectedCount: issue.pages_count,
            }))
          );
        }

        // 7. Update audit run
        await db
          .update(auditRuns)
          .set({
            status: "completed",
            pagesCrawled: pages.length,
            totalIssues: issues.length,
            criticalIssues: critical,
            warnings,
            notices,
            technicalScore: healthScore,
            completedAt: new Date(),
          })
          .where(eq(auditRuns.id, auditRunId));

        job.log(`Audit complete. Score: ${healthScore}, Issues: ${issues.length}`);
        return { auditRunId, healthScore, issueCount: issues.length };
      } catch (err) {
        await db
          .update(auditRuns)
          .set({ status: "failed", completedAt: new Date() })
          .where(eq(auditRuns.id, auditRunId));
        throw err;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 3, // Crawls are heavy — limit concurrency
    }
  );
}
