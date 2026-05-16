import type { MiddlewareHandler } from "hono";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import "../types.js";

export const clerkAuth = clerkMiddleware();

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const auth = getAuth(c);
  const authHeader = c.req.header("Authorization");
  console.log("[auth-debug]", {
    path: c.req.path,
    hasHeader: !!authHeader,
    headerPrefix: authHeader ? authHeader.slice(0, 16) + "..." : null,
    userId: auth?.userId ?? null,
    orgId: auth?.orgId ?? null,
    secretKeyLoaded: !!process.env["CLERK_SECRET_KEY"],
    publishableKeyLoaded: !!process.env["CLERK_PUBLISHABLE_KEY"],
  });
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (!auth.orgId) {
    return c.json({ error: "No active organization. Please select an organization." }, 403);
  }
  c.set("userId", auth.userId);
  c.set("orgId", auth.orgId);
  await next();
  return;
};

export { getAuth };
