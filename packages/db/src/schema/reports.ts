import {
  pgTable,
  text,
  pgEnum,
  jsonb,
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

// ── Report data types ─────────────────────────────────────────────────────────

export interface ReportData {
  title: string;
  type: string;
  sections: string[];
  dateRange: string;
  generatedAt: string;
  project: { id: string; domain: string; name: string };
  executiveSummary?: {
    overview: string;
    wins: string[];
    issues: string[];
    actions: Array<{ priority: string; action: string; impact: string }>;
  };
  siteHealth?: {
    score: number;
    criticalIssues: number;
    warnings: number;
    notices: number;
    pagesCrawled: number;
    cwvScore: number | null;
    previousScore: number | null;
  };
  technicalIssues?: {
    critical: Array<{ title: string; description: string; recommendation: string; affectedCount: number }>;
    warnings: Array<{ title: string; description: string; recommendation: string; affectedCount: number }>;
    crawledPages: number;
  };
  cwv?: {
    mobileScore: number | null;
    desktopScore: number | null;
    lcp_ms: number | null;
    cls: number | null;
  };
  aiSearch?: {
    score: number;
    llmsTxtFound: boolean;
    botAccess: Record<string, string>;
  };
  keywords?: {
    total: number;
    top3: number;
    top10: number;
    top100: number;
    topKeywords: Array<{ keyword: string; position: number }>;
  };
  gsc?: {
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
    topPages: Array<{ page: string; clicks: number; impressions: number }>;
  };
  recommendations?: Array<{
    priority: "high" | "medium" | "low";
    action: string;
    impact: string;
  }>;
}

// ── Table ─────────────────────────────────────────────────────────────────────

export const reports = pgTable("reports", {
  id: text("id").primaryKey().$defaultFn(createId),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  orgId: text("org_id").notNull().default(""),
  type: reportTypeEnum("type").notNull(),
  title: text("title").notNull().default("Untitled Report"),
  status: reportStatusEnum("status").notNull().default("pending"),
  sections: text("sections").array().notNull().default([]),
  dateRange: text("date_range").notNull().default("30d"),
  reportData: jsonb("report_data").$type<ReportData>(),
  fileUrl: text("file_url"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const reportsRelations = relations(reports, ({ one }) => ({
  project: one(projects, {
    fields: [reports.projectId],
    references: [projects.id],
  }),
}));
