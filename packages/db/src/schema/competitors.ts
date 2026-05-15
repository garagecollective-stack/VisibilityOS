import {
  pgTable,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { projects } from "./projects.js";
import { createId } from "../utils.js";

export const competitors = pgTable("competitors", {
  id: text("id").primaryKey().$defaultFn(createId),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  orgId: text("org_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Cached DataForSEO data (refresh every 7 days)
  organicKeywords: integer("organic_keywords"),
  organicTraffic: integer("organic_traffic"),
  domainRank: integer("domain_rank"),
  commonKeywords: integer("common_keywords"),
  lastFetchedAt: timestamp("last_fetched_at"),
});

export const competitorsRelations = relations(competitors, ({ one }) => ({
  project: one(projects, {
    fields: [competitors.projectId],
    references: [projects.id],
  }),
}));
