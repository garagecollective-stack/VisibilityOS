import type { DataForSEOConfig, DataForSEOResponse, CacheConfig } from "./types.js";

const DEFAULT_BASE_URL = "https://api.dataforseo.com";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_REQUESTS_PER_MINUTE = 2000;

// Token bucket for rate limiting
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(requestsPerMinute: number) {
    this.maxTokens = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.lastRefill = Date.now();
    this.refillRate = requestsPerMinute / 60_000;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.tokens = 0;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DataForSEOClient {
  private readonly authHeader: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly rateLimiter: RateLimiter;

  constructor(config: DataForSEOConfig) {
    const encoded = Buffer.from(`${config.login}:${config.password}`).toString("base64");
    this.authHeader = `Basic ${encoded}`;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.rateLimiter = new RateLimiter(config.requestsPerMinute ?? DEFAULT_REQUESTS_PER_MINUTE);
  }

  async post<T>(path: string, body: unknown): Promise<DataForSEOResponse<T>> {
    await this.rateLimiter.acquire();

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 30_000);
        const jitter = Math.random() * 500;
        console.log(`[DataForSEO] Retry ${attempt}/${this.maxRetries} for ${path} (backoff ${backoffMs + jitter}ms)`);
        await sleep(backoffMs + jitter);
      }

      const requestId = Math.random().toString(36).slice(2, 9);
      const startMs = Date.now();
      console.log(`[DataForSEO] [${requestId}] POST ${path}`);

      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          method: "POST",
          headers: {
            Authorization: this.authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const durationMs = Date.now() - startMs;

        if (res.status === 429) {
          console.warn(`[DataForSEO] [${requestId}] Rate limited (429) after ${durationMs}ms`);
          lastError = new Error("Rate limited by DataForSEO API");
          continue;
        }

        if (res.status >= 500) {
          const text = await res.text();
          console.error(`[DataForSEO] [${requestId}] Server error ${res.status} after ${durationMs}ms: ${text}`);
          lastError = new Error(`DataForSEO server error ${res.status}`);
          continue;
        }

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`DataForSEO request failed ${res.status}: ${text}`);
        }

        const data = (await res.json()) as DataForSEOResponse<T>;
        console.log(
          `[DataForSEO] [${requestId}] ${path} OK in ${durationMs}ms — tasks: ${data.tasks_count}, errors: ${data.tasks_error}, cost: $${data.cost}`
        );

        if (data.tasks_error > 0) {
          const errTask = data.tasks.find((t) => t.status_code !== 20000);
          if (errTask) {
            throw new Error(`DataForSEO task error ${errTask.status_code}: ${errTask.status_message}`);
          }
        }

        return data;
      } catch (err) {
        if (err instanceof Error && !err.message.startsWith("DataForSEO server error")) {
          throw err; // Non-retryable
        }
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError ?? new Error(`DataForSEO request failed after ${this.maxRetries} retries`);
  }

  async get<T>(path: string): Promise<DataForSEOResponse<T>> {
    await this.rateLimiter.acquire();

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 30_000);
        const jitter = Math.random() * 500;
        await sleep(backoffMs + jitter);
      }

      const startMs = Date.now();
      console.log(`[DataForSEO] GET ${path}`);

      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          method: "GET",
          headers: { Authorization: this.authHeader },
        });

        const durationMs = Date.now() - startMs;

        if (res.status === 429) {
          lastError = new Error("Rate limited");
          continue;
        }

        if (res.status >= 500) {
          lastError = new Error(`Server error ${res.status}`);
          continue;
        }

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`DataForSEO GET failed ${res.status}: ${text}`);
        }

        const data = (await res.json()) as DataForSEOResponse<T>;
        console.log(`[DataForSEO] GET ${path} OK in ${durationMs}ms`);
        return data;
      } catch (err) {
        if (err instanceof Error && !err.message.startsWith("Server error")) {
          throw err;
        }
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError ?? new Error(`DataForSEO GET failed after ${this.maxRetries} retries`);
  }
}

// ─── Cache-aware wrapper ───────────────────────────────────────────────────────

import { createHash } from "crypto";

export function makeCacheKey(endpoint: string, params: unknown): string {
  const hash = createHash("md5").update(JSON.stringify(params)).digest("hex").slice(0, 12);
  return `dfs:${endpoint.replace(/\//g, ":")}:${hash}`;
}

export async function withCache<T>(
  cache: CacheConfig,
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await cache.get(key);
  if (cached !== null) {
    return JSON.parse(cached) as T;
  }
  const result = await fetcher();
  await cache.set(key, JSON.stringify(result), ttlSeconds);
  return result;
}
