import type { MiddlewareHandler } from "hono";
import "../types.js";
import { getRedis } from "../lib/redis/index.js";
import { createHash } from "crypto";

interface CacheOptions {
  ttlSeconds: number;
  keyFn?: (c: Parameters<MiddlewareHandler>[0]) => string;
}

export function cacheResponse(opts: CacheOptions): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method !== "GET") {
      await next();
      return;
    }

    const redis = getRedis();
    const cacheKey = opts.keyFn
      ? opts.keyFn(c)
      : `http:${createHash("md5").update(c.req.url).digest("hex").slice(0, 16)}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      const { body, status, headers } = JSON.parse(cached) as {
        body: string;
        status: number;
        headers: Record<string, string>;
      };
      c.res = new Response(body, {
        status,
        headers: { ...headers, "X-Cache": "HIT" },
      });
      return;
    }

    await next();

    if (c.res.ok) {
      const body = await c.res.text();
      const headers: Record<string, string> = {};
      c.res.headers.forEach((value, key) => { headers[key] = value; });

      await redis.setex(
        cacheKey,
        opts.ttlSeconds,
        JSON.stringify({ body, status: c.res.status, headers })
      );

      c.res = new Response(body, {
        status: c.res.status,
        headers: { ...headers, "X-Cache": "MISS" },
      });
    }
  };
}
