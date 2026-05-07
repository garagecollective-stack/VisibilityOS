import { Worker, type Job } from "bullmq";
import type { GeoCheckJobData } from "./queues.js";
import { getRedisConnection } from "./queues.js";
import type { GEOCheckResult } from "@garage-seo/ai";
import { geoResults, createId } from "@garage-seo/db";

export function createGeoWorker(
  openai: import("@garage-seo/ai").OpenAIClient,
  perplexity: import("@garage-seo/ai").PerplexityClient,
  gemini: import("@garage-seo/ai").GeminiClient,
  db: import("@garage-seo/db").Database
) {
  return new Worker<GeoCheckJobData>(
    "geo-checks",
    async (job: Job<GeoCheckJobData>) => {
      const { promptId, promptText, platforms, targetDomain } = job.data;

      job.log(`Running GEO check for prompt: "${promptText.slice(0, 60)}..."`);

      const platformCheckers: Record<string, () => Promise<GEOCheckResult>> = {
        chatgpt: () => openai.checkGEOVisibility(promptText, targetDomain),
        perplexity: () => perplexity.checkGEOVisibility(promptText, targetDomain),
        gemini: () => gemini.checkGEOVisibility(promptText, targetDomain),
      };

      const results: GEOCheckResult[] = [];

      for (const platform of platforms) {
        const checker = platformCheckers[platform];
        if (!checker) continue;

        try {
          const result = await checker();
          results.push(result);
          job.log(`${platform}: cited=${result.cited}, position=${result.citationPosition}`);
        } catch (err) {
          job.log(`${platform} check failed: ${String(err)}`);
        }
      }

      // Store results
      if (results.length > 0) {
        await db.insert(geoResults).values(
          results.map((r) => ({
            id: createId(),
            promptId,
            platform: r.platform as "chatgpt" | "perplexity" | "gemini" | "google_aio",
            cited: r.cited,
            citationPosition: r.citationPosition,
            responseText: r.responseText.slice(0, 4000), // Truncate for storage
            checkedAt: new Date(),
          }))
        );
      }

      const citedCount = results.filter((r) => r.cited).length;
      job.log(`GEO check complete. Cited by ${citedCount}/${results.length} platforms`);

      return { promptId, results: results.map((r) => ({ platform: r.platform, cited: r.cited })) };
    },
    {
      connection: getRedisConnection(),
      concurrency: 5,
    }
  );
}
