import type { DataForSEOClient } from "./client.js";
import { makeCacheKey, withCache } from "./client.js";
import type { SerpResult, SerpTaskInfo, CacheConfig } from "./types.js";

export const CACHE_TTL_SERP = 21_600; // 6 hours

type Device = "desktop" | "mobile";

export class SerpClient {
  constructor(
    private readonly client: DataForSEOClient,
    private readonly cache?: CacheConfig
  ) {}

  /**
   * Submit a SERP task to the standard queue (1–3 min processing time).
   * Returns the task ID for polling.
   */
  async submitOrganicTask(
    keyword: string,
    locationCode: number,
    languageCode: string,
    device: Device = "desktop",
    depth: number = 100
  ): Promise<string> {
    const res = await this.client.post<{ id: string }>(
      "/v3/serp/google/organic/task_post",
      [
        {
          keyword,
          location_code: locationCode,
          language_code: languageCode,
          device,
          depth,
          os: device === "mobile" ? "android" : "windows",
        },
      ]
    );

    const taskId = res.tasks[0]?.id;
    if (!taskId) throw new Error("DataForSEO SERP task submission returned no task ID");
    return taskId;
  }

  /**
   * Poll for a previously submitted SERP task result.
   */
  async getOrganicTaskResult(taskId: string): Promise<SerpResult | null> {
    const res = await this.client.get<SerpResult>(
      `/v3/serp/google/organic/task_get/${taskId}`
    );
    const result = res.tasks[0]?.result?.[0];
    return result ?? null;
  }

  /**
   * Submit + poll until done or timeout (default 5 min).
   * Caches result after retrieval.
   */
  async getOrganicResults(
    keyword: string,
    locationCode: number,
    languageCode: string,
    device: Device = "desktop",
    depth: number = 100,
    timeoutMs: number = 300_000
  ): Promise<SerpResult> {
    const cacheParams = { keyword, locationCode, languageCode, device, depth };

    const fetcher = async (): Promise<SerpResult> => {
      const taskId = await this.submitOrganicTask(keyword, locationCode, languageCode, device, depth);

      const pollIntervalMs = 10_000; // 10s
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
        const result = await this.getOrganicTaskResult(taskId);
        if (result !== null) return result;
      }

      throw new Error(`SERP task ${taskId} timed out after ${timeoutMs}ms`);
    };

    if (this.cache) {
      const key = makeCacheKey("serp/organic", cacheParams);
      return withCache(this.cache, key, CACHE_TTL_SERP, fetcher);
    }
    return fetcher();
  }

  /**
   * Check task status without fetching full results.
   */
  async getTaskStatus(taskId: string): Promise<SerpTaskInfo> {
    const res = await this.client.get<SerpResult>(
      `/v3/serp/google/organic/task_get/${taskId}`
    );
    const task = res.tasks[0];
    if (!task) throw new Error(`Task ${taskId} not found`);

    let status: SerpTaskInfo["status"] = "queued";
    if (task.status_code === 20000) status = "ready";
    else if (task.status_code === 20100) status = "processing";
    else if (task.status_code === 40000 || task.status_code >= 50000) status = "failed";
    else if (task.status_code === 20001) status = "in_queue";

    return { taskId, status };
  }
}
