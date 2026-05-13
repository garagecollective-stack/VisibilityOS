import {
  pgTable,
  text,
  integer,
  real,
  pgEnum,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { projects } from "./projects.js";
import { createId } from "../utils.js";

export interface CrawledPageSummary {
  url: string;
  status_code: number;
  title: string | null;
  has_meta_desc: boolean;
  has_h1: boolean;
  word_count: number;
  is_https: boolean;
  issues_count: number;
}

export const auditStatusEnum = pgEnum("audit_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const severityEnum = pgEnum("severity", ["critical", "warning", "notice"]);

export const issueCategoryEnum = pgEnum("issue_category", [
  "meta",
  "links",
  "speed",
  "content",
  "schema",
  "mobile",
  "security",
  "indexing",
  "cwv",
]);

export const auditRuns = pgTable("audit_runs", {
  id: text("id").primaryKey().$defaultFn(createId),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  status: auditStatusEnum("status").notNull().default("pending"),
  pagesCrawled: integer("pages_crawled").notNull().default(0),
  totalIssues: integer("total_issues").notNull().default(0),
  criticalIssues: integer("critical_issues").notNull().default(0),
  warnings: integer("warnings").notNull().default(0),
  notices: integer("notices").notNull().default(0),
  technicalScore: real("technical_score"),
  cwvScore: real("cwv_score"),
  crawledPages: jsonb("crawled_pages").$type<CrawledPageSummary[]>().notNull().default([]),
  failureReason: text("failure_reason"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const auditRunsRelations = relations(auditRuns, ({ one, many }) => ({
  project: one(projects, {
    fields: [auditRuns.projectId],
    references: [projects.id],
  }),
  issues: many(auditIssues),
}));

export const auditIssues = pgTable("audit_issues", {
  id: text("id").primaryKey().$defaultFn(createId),
  runId: text("run_id")
    .notNull()
    .references(() => auditRuns.id, { onDelete: "cascade" }),
  severity: severityEnum("severity").notNull(),
  category: issueCategoryEnum("category").notNull(),
  url: text("url"),
  affectedUrls: text("affected_urls").array().notNull().default([]),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  recommendation: text("recommendation").notNull().default(""),
  affectedCount: integer("affected_count").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditIssuesRelations = relations(auditIssues, ({ one }) => ({
  run: one(auditRuns, {
    fields: [auditIssues.runId],
    references: [auditRuns.id],
  }),
}));
