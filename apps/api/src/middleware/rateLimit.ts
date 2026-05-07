import type { MiddlewareHandler } from "hono";
import { Redis } from "ioredis";
import "../types.js";

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyFn?: (c: Parameters<MiddlewareHandler>[0]) => string;
}

let _redis: Redis | undefined;
function getRedis(): Redis {
  if (_redis) return _redis;
  _redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379");
  return _redis;
}

// Sliding window rate limiter using Redis sorted sets
export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const redis = getRedis();
    const key = opts.keyFn
      ? opts.keyFn(c)
      : `rl:${c.get("orgId") ?? c.req.header("x-forwarded-for") ?? "anon"}`;

    const now = Date.now();
    const windowStart = now - opts.windowSeconds * 1000;

    const pipe = redis.pipeline();
    pipe.zremrangebyscore(key, "-inf", windowStart);
    pipe.zadd(key, now, `${now}-${Math.random()}`);
    pipe.zcard(key);
    pipe.expire(key, opts.windowSeconds);

    const results = await pipe.exec();
    const count = (results?.[2]?.[1] ?? 0) as number;

    c.res.headers.set("X-RateLimit-Limit", String(opts.maxRequests));
    c.res.headers.set("X-RateLimit-Remaining", String(Math.max(0, opts.maxRequests - count)));

    if (count > opts.maxRequests) {
      return c.json(
        { error: "Rate limit exceeded", retryAfter: opts.windowSeconds },
        429
      );
    }

    await next();
    return;
  };
}

export const apiRateLimit = rateLimit({ windowSeconds: 60, maxRequests: 120 });
export const strictRateLimit = rateLimit({ windowSeconds: 60, maxRequests: 20 });
