import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), "../../.env") });

import { getDb, closeDb } from "./connection.js";
import {
  organizations,
  users,
  projects,
  trackedKeywords,
  keywordLists,
  keywordListItems,
  billing,
} from "./schema/index.js";
import { createId } from "./utils.js";

async function seed() {
  const db = getDb();
  console.log("[Seed] Starting...");

  // ─── Organization ──────────────────────────────────────────────────────────
  const orgId = createId();
  await db.insert(organizations).values({
    id: orgId,
    name: "VisibilityOS Demo",
    slug: "garage-demo",
    plan: "agency",
  });
  console.log("[Seed] Created organization:", orgId);

  // ─── User ──────────────────────────────────────────────────────────────────
  const userId = createId();
  await db.insert(users).values({
    id: userId,
    orgId,
    clerkUserId: "user_demo_seed_001",
    email: "demo@visibilityos.ai",
    role: "admin",
  });

  // ─── Projects ──────────────────────────────────────────────────────────────
  const project1Id = createId();
  await db.insert(projects).values([
    {
      id: project1Id,
      orgId,
      domain: "visibilityos.ai",
      name: "VisibilityOS",
      countryCode: "IN",
      languageCode: "en",
      settings: {
        competitors: ["semrush.com", "ahrefs.com", "moz.com"],
        alertsEnabled: true,
        rankDropThreshold: 5,
        crawlFrequency: "weekly",
      },
    },
    {
      id: createId(),
      orgId,
      domain: "example-client.com",
      name: "Example Client Site",
      countryCode: "US",
      languageCode: "en",
      settings: { alertsEnabled: false },
    },
  ]);

  // ─── Tracked Keywords ──────────────────────────────────────────────────────
  const kwIds = [
    "seo tools india",
    "keyword research tool",
    "rank tracker software",
    "technical seo audit",
    "backlink checker",
    "competitor analysis seo",
    "google search console integration",
    "seo platform for agencies",
    "affordable seo tools",
    "site audit tool",
  ].map((keyword) => {
    const id = createId();
    return { id, keyword };
  });

  await db.insert(trackedKeywords).values(
    kwIds.map(({ id, keyword }) => ({
      id,
      projectId: project1Id,
      keyword,
      locationCode: "2356", // India
      languageCode: "en",
      device: "desktop" as const,
      isActive: true,
    }))
  );

  // ─── Keyword List ──────────────────────────────────────────────────────────
  const listId = createId();
  await db.insert(keywordLists).values({
    id: listId,
    projectId: project1Id,
    name: "Core Brand Keywords",
    tags: ["brand", "priority"],
  });

  await db.insert(keywordListItems).values(
    kwIds.slice(0, 5).map(({ id }) => ({
      id: createId(),
      listId,
      keywordId: id,
    }))
  );

  // ─── Billing ───────────────────────────────────────────────────────────────
  await db.insert(billing).values({
    id: createId(),
    orgId,
    plan: "agency",
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  console.log("[Seed] Complete. Project ID:", project1Id);
  await closeDb();
}

seed().catch((err) => {
  console.error("[Seed] Failed:", err);
  process.exit(1);
});
