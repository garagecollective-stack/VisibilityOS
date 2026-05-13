ALTER TYPE "public"."issue_category" ADD VALUE 'ai_search';--> statement-breakpoint
ALTER TABLE "audit_runs" ADD COLUMN "ai_crawler_access" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_runs" ADD COLUMN "raw_metrics_json" jsonb DEFAULT '{}'::jsonb NOT NULL;