import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
config({ path: resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../.env") });

import { serve } from "@hono/node-server";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { clerkAuth, requireAuth } from "./middleware/auth.js";
import { apiRateLimit } from "./middleware/rateLimit.js";

import projectsRouter from "./routes/projects.js";
import keywordsRouter from "./routes/keywords.js";
import rankRouter from "./routes/rank.js";
import auditRouter from "./routes/audit.js";
import backlinksRouter from "./routes/backlinks.js";
import competitorsRouter from "./routes/competitors.js";
import geoRouter from "./routes/geo.js";
import billingRouter, { razorpayWebhookHandler } from "./routes/billing.js";

const app = new Hono();

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

app.get("/health", (c) =>
  c.json({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() })
);

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

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[API] Listening on http://localhost:${info.port}`);
});
