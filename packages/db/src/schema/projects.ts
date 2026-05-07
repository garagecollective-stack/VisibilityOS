import {
  pgTable,
  text,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { trackedKeywords } from "./keywords.js";
import { auditRuns } from "./audit.js";
import { backlinkSnapshots } from "./backlinks.js";
import { geoPrompts } from "./geo.js";
import { reports } from "./reports.js";
import { createId } from "../utils.js";

export const projects = pgTable("projects", {
  id: text("id").primaryKey().$defaultFn(createId),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  name: text("name").notNull(),
  countryCode: text("country_code").notNull().default("IN"),
  languageCode: text("language_code").notNull().default("en"),
  gscConnected: boolean("gsc_connected").notNull().default(false),
  ga4Connected: boolean("ga4_connected").notNull().default(false),
  settings: jsonb("settings").$type<ProjectSettings>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export interface ProjectSettings {
  competitors?: string[];
  alertsEnabled?: boolean;
  rankDropThreshold?: number;
  crawlFrequency?: "daily" | "weekly" | "monthly";
  gscPropertyUrl?: string;
  ga4PropertyId?: string;
}

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.orgId],
    references: [organizations.id],
  }),
  trackedKeywords: many(trackedKeywords),
  auditRuns: many(auditRuns),
  backlinkSnapshots: many(backlinkSnapshots),
  geoPrompts: many(geoPrompts),
  reports: many(reports),
}));
