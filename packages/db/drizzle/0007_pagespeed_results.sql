ALTER TABLE "audit_runs" ADD COLUMN IF NOT EXISTS "pagespeed_results" jsonb DEFAULT '[]'::jsonb NOT NULL;
