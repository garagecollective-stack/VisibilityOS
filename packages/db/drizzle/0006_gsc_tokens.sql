ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "gsc_refresh_token" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "gsc_access_token" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "gsc_token_expires_at" timestamp;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "gsc_connected_email" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "gsc_property_url" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "gsc_last_synced_at" timestamp;
