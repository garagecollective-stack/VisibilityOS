import type { MiddlewareHandler } from "hono";
import "../types.js";

type PlanResource = "projects" | "keywords";

export function enforcePlanLimit(_resource: PlanResource): MiddlewareHandler {
  // Limits temporarily disabled — all plans are unrestricted.
  return async (_c, next) => {
    await next();
  };
}
