import {
  pgTable,
  text,
  boolean,
  pgEnum,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { projects } from "./projects.js";
import { createId } from "../utils.js";

export const deviceEnum = pgEnum("device", ["desktop", "mobile"]);

export const trackedKeywords = pgTable("tracked_keywords", {
  id: text("id").primaryKey().$defaultFn(createId),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  keyword: text("keyword").notNull(),
  locationCode: text("location_code").notNull(),
  languageCode: text("language_code").notNull().default("en"),
  device: deviceEnum("device").notNull().default("desktop"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const trackedKeywordsRelations = relations(trackedKeywords, ({ one, many }) => ({
  project: one(projects, {
    fields: [trackedKeywords.projectId],
    references: [projects.id],
  }),
  keywordListItems: many(keywordListItems),
}));

export const keywordLists = pgTable("keyword_lists", {
  id: text("id").primaryKey().$defaultFn(createId),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const keywordListsRelations = relations(keywordLists, ({ one, many }) => ({
  project: one(projects, {
    fields: [keywordLists.projectId],
    references: [projects.id],
  }),
  items: many(keywordListItems),
}));

export const keywordListItems = pgTable("keyword_list_items", {
  id: text("id").primaryKey().$defaultFn(createId),
  listId: text("list_id")
    .notNull()
    .references(() => keywordLists.id, { onDelete: "cascade" }),
  keywordId: text("keyword_id")
    .notNull()
    .references(() => trackedKeywords.id, { onDelete: "cascade" }),
});

export const keywordListItemsRelations = relations(keywordListItems, ({ one }) => ({
  list: one(keywordLists, {
    fields: [keywordListItems.listId],
    references: [keywordLists.id],
  }),
  keyword: one(trackedKeywords, {
    fields: [keywordListItems.keywordId],
    references: [trackedKeywords.id],
  }),
}));
