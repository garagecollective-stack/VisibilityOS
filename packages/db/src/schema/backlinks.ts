import {
  pgTable,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { projects } from "./projects.js";
import { createId } from "../utils.js";

export const backlinkSnapshots = pgTable("backlink_snapshots", {
  id: text("id").primaryKey().$defaultFn(createId),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  totalBacklinks: integer("total_backlinks").notNull().default(0),
  referringDomains: integer("referring_domains").notNull().default(0),
  domainRank: integer("domain_rank").notNull().default(0),
  newBacklinks: integer("new_backlinks").notNull().default(0),
  lostBacklinks: integer("lost_backlinks").notNull().default(0),
  checkedAt: timestamp("checked_at").notNull().defaultNow(),
});

export const backlinkSnapshotsRelations = relations(backlinkSnapshots, ({ one }) => ({
  project: one(projects, {
    fields: [backlinkSnapshots.projectId],
    references: [projects.id],
  }),
}));
