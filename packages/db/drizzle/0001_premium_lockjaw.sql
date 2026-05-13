ALTER TABLE "audit_issues" ADD COLUMN "affected_urls" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_runs" ADD COLUMN "crawled_pages" jsonb DEFAULT '[]'::jsonb NOT NULL;