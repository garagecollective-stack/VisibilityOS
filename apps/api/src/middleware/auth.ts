import type { MiddlewareHandler } from "hono";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import "../types.js";

export const clerkAuth = clerkMiddleware();

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const auth = getAuth(c);
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
