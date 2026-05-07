import {
  pgTable,
  text,
  pgEnum,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { projects } from "./projects.js";
import { createId } from "../utils.js";

export const reportTypeEnum = pgEnum("report_type", [
  "full_seo",
  "keyword_report",
  "backlink_report",
  "audit_report",
  "competitor_report",
  "custom",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "generating",
  "ready",
  "failed",
]);

export const reports = pgTable("reports", {
  id: text("id").primaryKey().$defaultFn(createId),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: reportTypeEnum("type").notNull(),
  status: reportStatusEnum("status").notNull().default("pending"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reportsRelations = relations(reports, ({ one }) => ({
  project: one(projects, {
    fields: [reports.projectId],
    references: [projects.id],
  }),
}));
