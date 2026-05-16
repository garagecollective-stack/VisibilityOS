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

export interface AiCrawlerAccess {
  chatgpt_user?: "allowed" | "blocked" | "unknown";
  oai_searchbot?: "allowed" | "blocked" | "unknown";
  gptbot?: "allowed" | "blocked" | "unknown";
  google_extended?: "allowed" | "blocked" | "unknown";
  perplexitybot?: "allowed" | "blocked" | "unknown";
  claudebot?: "allowed" | "blocked" | "unknown";
}

export interface RawMetricsJson {
  pages_crawled?: number;
  site_health_score?: number;
  total_issues?: number;
  total_errors?: number;
  total_warnings?: number;
  total_notices?: number;
  meta_errors?: number;
  meta_warnings?: number;
  links_errors?: number;
  links_warnings?: number;
  speed_warnings?: number;
  content_warnings?: number;
  schema_notices?: number;
  mobile_errors?: number;
  security_errors?: number;
  indexing_warnings?: number;
  cwv_failures?: number;
  ai_search_issues?: number;
  ai_search_score?: number;
  llms_txt_found?: boolean;
}

export interface PageSpeedEntry {
  url: string;
  is_homepage: boolean;
  mobile_score: number;
  desktop_score: number;
  lcp_ms: number;
  cls: number;
  tbt_ms: number;
  fcp_ms: number;
  opportunities: Array<{ title: string; savings_ms: number }>;
}

export interface CrawledPageSummary {
  url: string;
  status_code: number;
  title: string | null;
  has_meta_desc: boolean;
  has_h1: boolean;
  word_count: number;
  is_https: boolean;
  issues_count: number;
  has_json_ld?: boolean;
  has_canonical?: boolean;
  incoming_links_count?: number;
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
  "ai_search",
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
  aiCrawlerAccess: jsonb("ai_crawler_access").$type<AiCrawlerAccess>().notNull().default({}),
  rawMetricsJson: jsonb("raw_metrics_json").$type<RawMetricsJson>().notNull().default({}),
  pagespeedResults: jsonb("pagespeed_results").$type<PageSpeedEntry[]>().notNull().default([]),
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
