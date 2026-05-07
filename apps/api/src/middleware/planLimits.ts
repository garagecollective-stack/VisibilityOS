import type { MiddlewareHandler } from "hono";
import { getDb } from "../lib/db/index.js";
import { organizations, projects, trackedKeywords } from "@garage-seo/db";
import { eq, count, inArray } from "drizzle-orm";
import "../types.js";

type PlanResource = "projects" | "keywords";

const PLAN_LIMITS: Record<string, Record<PlanResource, number>> = {
  starter:    { projects: 1,         keywords: 50 },
  pro:        { projects: 5,         keywords: 500 },
  agency:     { projects: 30,        keywords: 3000 },
  enterprise: { projects: Infinity,  keywords: Infinity },
};

export function enforcePlanLimit(resource: PlanResource): MiddlewareHandler {
  return async (c, next) => {
    const orgId = c.get("orgId");
    const db = getDb();

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    if (!org) return c.json({ error: "Organization not found" }, 404);

    const limits = PLAN_LIMITS[org.plan] ?? PLAN_LIMITS["starter"]!;

    let currentCount = 0;
    if (resource === "projects") {
      const [row] = await db
        .select({ count: count() })
        .from(projects)
        .where(eq(projects.orgId, orgId));
      currentCount = row?.count ?? 0;
    } else if (resource === "keywords") {
      const orgProjects = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.orgId, orgId));

      if (orgProjects.length > 0) {
        const projectIds = orgProjects.map((p) => p.id);
        const [row] = await db
          .select({ count: count() })
          .from(trackedKeywords)
          .where(inArray(trackedKeywords.projectId, projectIds));
        currentCount = row?.count ?? 0;
      }
    }

    const limit = limits[resource]!;
    if (currentCount >= limit) {
      return c.json(
        {
          error: "Plan limit reached",
          resource,
          limit,
          current: currentCount,
          upgrade: true,
          message: `Your ${org.plan} plan allows ${limit} ${resource}. Upgrade to add more.`,
        },
        402
      );
    }

    c.set("planLimitRemaining", limit - currentCount);
    await next();
    return;
  };
}
