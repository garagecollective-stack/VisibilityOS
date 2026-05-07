import {
  pgTable,
  text,
  boolean,
  integer,
  pgEnum,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { projects } from "./projects.js";
import { createId } from "../utils.js";

export const geoPlatformEnum = pgEnum("geo_platform", [
  "chatgpt",
  "perplexity",
  "gemini",
  "google_aio",
]);

export const geoPrompts = pgTable("geo_prompts", {
  id: text("id").primaryKey().$defaultFn(createId),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  promptText: text("prompt_text").notNull(),
  platforms: text("platforms").array().notNull().default(["chatgpt", "perplexity", "gemini", "google_aio"]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const geoPromptsRelations = relations(geoPrompts, ({ one, many }) => ({
  project: one(projects, {
    fields: [geoPrompts.projectId],
    references: [projects.id],
  }),
  results: many(geoResults),
}));

export const geoResults = pgTable("geo_results", {
  id: text("id").primaryKey().$defaultFn(createId),
  promptId: text("prompt_id")
    .notNull()
    .references(() => geoPrompts.id, { onDelete: "cascade" }),
  platform: geoPlatformEnum("platform").notNull(),
  cited: boolean("cited").notNull().default(false),
  citationPosition: integer("citation_position"),
  responseText: text("response_text").notNull().default(""),
  checkedAt: timestamp("checked_at").notNull().defaultNow(),
});

export const geoResultsRelations = relations(geoResults, ({ one }) => ({
  prompt: one(geoPrompts, {
    fields: [geoResults.promptId],
    references: [geoPrompts.id],
  }),
}));
