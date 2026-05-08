import { Redis } from "ioredis";

let _redis: Redis | undefined;

export function getRedis(): Redis {
  if (_redis) return _redis;
  _redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379");
  return _redis;
}

export const CACHE_TTL = {
  KEYWORD_DATA: 86_400,    // 24h
  SERP_DATA: 21_600,       // 6h
  BACKLINK_DATA: 43_200,   // 12h
  DOMAIN_METRICS: 86_400,  // 24h
  PAGESPEED: 86_400,       // 24h
  GSC_DATA: 3_600,         // 1h
} as const;

export function makeCacheAdapter(redis: Redis) {
  return {
    get: (key: string) => redis.get(key),
    set: (key: string, value: string, ttlSeconds: number) =>
      redis.setex(key, ttlSeconds, value).then(() => undefined),
  };
}

export interface RedisHealthCheckResult {
  ping: string;
  write_read_test: "passed" | "failed";
  total_keys: number;
}

export async function runRedisHealthCheck(redis = getRedis()): Promise<RedisHealthCheckResult> {
  const testKey = "health:test";
  let writeReadTest: "passed" | "failed" = "failed";

  const ping = await redis.ping();
  await redis.set(testKey, "ok", "EX", 60);
  const value = await redis.get(testKey);
  writeReadTest = value === "ok" ? "passed" : "failed";
  await redis.del(testKey);

  const totalKeys = await redis.dbsize();

  return {
    ping,
    write_read_test: writeReadTest,
    total_keys: totalKeys,
  };
}
