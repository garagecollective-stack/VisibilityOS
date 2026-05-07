import { Worker, type Job } from "bullmq";
import type { RankCheckJobData } from "./queues.js";
import { getRedisConnection } from "./queues.js";
import { projects } from "@garage-seo/db";
import { eq } from "drizzle-orm";

const CTR_CURVE: Record<number, number> = {
  1: 0.317, 2: 0.247, 3: 0.186, 4: 0.13,  5: 0.09,
  6: 0.06,  7: 0.04,  8: 0.03,  9: 0.02,  10: 0.015,
};

export interface KeywordRank {
  keywordId: string;
  position: number;
  volume: number;
}

export function calculateVisibilityScore(keywords: KeywordRank[]): number {
  const totalVolume = keywords.reduce((sum, kw) => sum + kw.volume, 0);
  if (totalVolume === 0) return 0;

  const weightedCTR = keywords.reduce((sum, kw) => {
    const ctr = CTR_CURVE[kw.position] ?? 0.01;
    return sum + ctr * kw.volume;
  }, 0);

  return (weightedCTR / totalVolume) * 100;
}

function extractSerpFeatures(items: Array<{ type: string }>): string[] {
  const featureTypes = new Set<string>();
  for (const item of items) {
    if (item.type !== "organic") featureTypes.add(item.type);
  }
  return Array.from(featureTypes);
}

export function createRankWorker(
  dataforSEO: import("@garage-seo/dataforseo").DataForSEO,
  clickhouse: { query: (sql: string) => Promise<unknown[]>; insert: (table: string, rows: unknown[]) => Promise<void> },
  db: import("@garage-seo/db").Database,
  sendAlert: (projectId: string, keyword: string, from: number, to: number) => Promise<void>
) {
  return new Worker<RankCheckJobData>(
    "rank-checks",
    async (job: Job<RankCheckJobData>) => {
      const { projectId, keywordId, keyword, locationCode, device, domain } = job.data;

      job.log(`Processing rank check: "${keyword}" for project ${projectId}`);

      // 1. Fetch SERP
      const serpResult = await dataforSEO.serp.getOrganicResults(
        keyword,
        locationCode,
        "en",
        device,
        100
      );

      // 2. Find our position
      const ourResult = serpResult.items.find((item) => item.domain === domain);
      const currentPosition = ourResult?.rank_absolute ?? 0;

      // 3. Extract competitor positions from the same SERP response (no extra cost)
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });
      const competitors: string[] = (project?.settings as { competitors?: string[] } | null)?.competitors ?? [];

      const competitorPositions = competitors.map((comp) => ({
        domain: comp,
        position: serpResult.items.find((i) => i.domain === comp)?.rank_absolute ?? null,
      }));

      job.log(`Position: ${currentPosition}, competitors tracked: ${competitors.length}`);

      // 4. Get previous position from ClickHouse
      const prevRows = await clickhouse.query(
        `SELECT position FROM rank_history
         WHERE keyword_id = '${keywordId}'
         ORDER BY checked_at DESC
         LIMIT 1`
      ) as Array<{ position: number }>;

      const previousPosition = prevRows[0]?.position ?? 0;

      // 5. Insert into ClickHouse
      await clickhouse.insert("rank_history", [
        {
          project_id: projectId,
          keyword_id: keywordId,
          keyword,
          position: currentPosition,
          previous_position: previousPosition,
          url: ourResult?.url ?? "",
          serp_features: extractSerpFeatures(serpResult.items),
          location_code: locationCode,
          device,
          checked_at: new Date(),
        },
      ]);

      // 6. Alert on significant drop
      if (previousPosition > 0 && currentPosition > 0) {
        const drop = currentPosition - previousPosition;
        if (drop >= 5) {
          await sendAlert(projectId, keyword, previousPosition, currentPosition);
          job.log(`Alert sent: dropped from ${previousPosition} to ${currentPosition}`);
        }
      }

      return { keywordId, position: currentPosition, previousPosition, competitorPositions };
    },
    {
      connection: getRedisConnection(),
      concurrency: 10,
    }
  );
}
