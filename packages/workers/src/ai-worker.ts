import { Worker, type Job } from "bullmq";
import type { AITaskJobData } from "./queues.js";
import { getRedisConnection } from "./queues.js";

export function createAIWorker(
  claude: import("@garage-seo/ai").ClaudeClient
) {
  return new Worker<AITaskJobData>(
    "ai-tasks",
    async (job: Job<AITaskJobData>) => {
      const { type, payload } = job.data;

      switch (type) {
        case "content_analysis": {
          const { url, content, targetKeywords } = payload as {
            url: string;
            content: string;
            targetKeywords: string[];
          };
          return claude.analyzeContent(url, content, targetKeywords);
        }

        case "content_brief": {
          const { keyword, competitorUrls, targetAudience } = payload as {
            keyword: string;
            competitorUrls: string[];
            targetAudience: string;
          };
          const brief = await claude.generateContentBrief(keyword, competitorUrls, targetAudience);
          return { brief };
        }

        case "issue_classify": {
          const { title, description, pageUrl } = payload as {
            title: string;
            description: string;
            pageUrl: string;
          };
          return claude.classifyIssue(title, description, pageUrl);
        }

        case "rank_summary": {
          const { domain, winners, losers } = payload as {
            domain: string;
            winners: Array<{ keyword: string; change: number }>;
            losers: Array<{ keyword: string; change: number }>;
          };
          const summary = await claude.summarizeRankMovement(domain, winners, losers);
          return { summary };
        }

        default:
          throw new Error(`Unknown AI task type: ${type}`);
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 5,
    }
  );
}
