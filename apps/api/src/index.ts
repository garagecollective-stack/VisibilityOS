import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
config({ path: resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../.env") });

import { serve } from "@hono/node-server";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { sql, and, eq, lt } from "drizzle-orm";
import { auditRuns } from "@garage-seo/db";
import { clerkAuth, requireAuth } from "./middleware/auth.js";
import { apiRateLimit } from "./middleware/rateLimit.js";
import { getDb } from "./lib/db/index.js";
import { getRedis, runRedisHealthCheck } from "./lib/redis/index.js";
import { clickhouse, listClickHouseTables } from "./lib/clickhouse/index.js";

import projectsRouter from "./routes/projects.js";
import keywordsRouter from "./routes/keywords.js";
import rankRouter from "./routes/rank.js";
import auditRouter from "./routes/audit.js";
import backlinksRouter from "./routes/backlinks.js";
import competitorsRouter from "./routes/competitors.js";
import geoRouter from "./routes/geo.js";
import billingRouter, { razorpayWebhookHandler } from "./routes/billing.js";
import dashboardRouter from "./routes/dashboard.js";

const app = new Hono();

const expectedPostgresTables = [
  "organizations",
  "users",
  "projects",
  "tracked_keywords",
  "keyword_lists",
  "keyword_list_items",
  "audit_runs",
  "audit_issues",
  "backlink_snapshots",
  "geo_prompts",
  "geo_results",
  "reports",
  "billing",
] as const;

const expectedClickHouseTables = [
  "rank_history",
  "gsc_metrics",
  "keyword_metric_history",
] as const;

// ─── Global middleware ─────────────────────────────────────────────────────────

app.use("*", logger());
app.use("*", secureHeaders());
const allowedOrigins = ["http://localhost:3000", "http://localhost:3003"];
const appUrl = process.env["NEXT_PUBLIC_APP_URL"];
if (appUrl && !allowedOrigins.includes(appUrl)) allowedOrigins.push(appUrl);

app.use(
  "*",
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ─── Public endpoints (no auth) ───────────────────────────────────────────────

app.get("/health", async (c) => {
  const postgres = {
    status: "connected" as "connected" | "error",
    latency_ms: 0,
    error: null as string | null,
    tables_found: [] as string[],
    tables_missing: [] as string[],
  };

  const redis = {
    status: "connected" as "connected" | "error",
    latency_ms: 0,
    error: null as string | null,
    ping: null as string | null,
    write_read_test: "failed" as "passed" | "failed",
    total_keys: 0,
  };

  const clickhouseService = {
    status: "connected" as "connected" | "error",
    latency_ms: 0,
    error: null as string | null,
    tables_found: [] as string[],
    tables_missing: [] as string[],
  };

  await Promise.all([
    (async () => {
      const startedAt = Date.now();
      try {
        const db = getDb();
        await db.execute(sql`SELECT 1`);
        const tableRows = await db.execute(sql`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name
        `);
        const tablesFound = tableRows.rows
          .map((row) => row.table_name)
          .filter((tableName): tableName is string => typeof tableName === "string");

        postgres.latency_ms = Date.now() - startedAt;
        postgres.tables_found = tablesFound;
        postgres.tables_missing = expectedPostgresTables.filter(
          (tableName) => !tablesFound.includes(tableName)
        );
      } catch (err) {
        postgres.status = "error";
        postgres.latency_ms = Date.now() - startedAt;
        postgres.error = err instanceof Error ? err.message : String(err);
      }
    })(),
    (async () => {
      const startedAt = Date.now();
      try {
        const health = await runRedisHealthCheck(getRedis());
        redis.latency_ms = Date.now() - startedAt;
        redis.ping = health.ping;
        redis.write_read_test = health.write_read_test;
        redis.total_keys = health.total_keys;
      } catch (err) {
        redis.status = "error";
        redis.latency_ms = Date.now() - startedAt;
        redis.error = err instanceof Error ? err.message : String(err);
      }
    })(),
    (async () => {
      const startedAt = Date.now();
      try {
        await clickhouse.query("SELECT 1");
        const tablesFound = await listClickHouseTables();
        clickhouseService.latency_ms = Date.now() - startedAt;
        clickhouseService.tables_found = tablesFound;
        clickhouseService.tables_missing = expectedClickHouseTables.filter(
          (tableName) => !tablesFound.includes(tableName)
        );
      } catch (err) {
        clickhouseService.status = "error";
        clickhouseService.latency_ms = Date.now() - startedAt;
        clickhouseService.error = err instanceof Error ? err.message : String(err);
        clickhouseService.tables_missing = [...expectedClickHouseTables];
      }
    })(),
  ]);

  const status =
    postgres.status === "connected" &&
    redis.status === "connected" &&
    clickhouseService.status === "connected"
      ? "ok"
      : "degraded";

  return c.json({
    status,
    services: {
      postgres,
      redis,
      clickhouse: clickhouseService,
    },
  });
});

// Razorpay webhook — unauthenticated, verified by HMAC signature
app.post("/api/billing/webhook/razorpay", razorpayWebhookHandler);

// ─── Clerk auth on all /api/* routes ─────────────────────────────────────────

app.use("/api/*", clerkAuth);

// ─── Protected API routes ──────────────────────────────────────────────────────

const api = new Hono();
api.use("*", requireAuth);
api.use("*", apiRateLimit);

api.route("/projects", projectsRouter);
api.route("/keywords", keywordsRouter);
api.route("/rank", rankRouter);
api.route("/audit", auditRouter);
api.route("/backlinks", backlinksRouter);
api.route("/competitors", competitorsRouter);
api.route("/geo", geoRouter);
api.route("/billing", billingRouter);
api.route("/dashboard", dashboardRouter);

app.route("/api", api);

// ─── Global error handler ──────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error("[API Error]", err);
  const status = err.message.includes("not found") ? 404 : 500;
  return c.json(
    {
      error: process.env["NODE_ENV"] === "production" ? "Internal server error" : err.message,
    },
    status
  );
});

// ─── Start ─────────────────────────────────────────────────────────────────────

const port = parseInt(process.env["PORT"] ?? "3001", 10);

// One-time startup reconciliation: mark interrupted audits as failed.
// If the API process restarts while an audit is running, the row is left
// stuck at status='running' forever. Anything older than 15 minutes is
// almost certainly orphaned by a restart.
async function reconcileStuckAudits(): Promise<void> {
  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const updated = await db
      .update(auditRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        failureReason: "Interrupted — server restarted",
      })
      .where(and(eq(auditRuns.status, "running"), lt(auditRuns.startedAt, cutoff)))
      .returning({ id: auditRuns.id });
    if (updated.length > 0) {
      console.log(
        `[startup] reconciled ${updated.length} stuck audit run(s) as failed (interrupted — server restarted): ${updated.map((r) => r.id).join(", ")}`
      );
    }
  } catch (err) {
    console.error("[startup] failed to reconcile stuck audits:", err instanceof Error ? err.message : err);
  }
}

void reconcileStuckAudits();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[API] Listening on http://localhost:${info.port}`);
});
