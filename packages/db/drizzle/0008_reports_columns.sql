ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "org_id" text NOT NULL DEFAULT '';
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "title" text NOT NULL DEFAULT 'Untitled Report';
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "report_data" jsonb;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "sections" text[] DEFAULT '{}';
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "date_range" text NOT NULL DEFAULT '30d';
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "failure_reason" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;
