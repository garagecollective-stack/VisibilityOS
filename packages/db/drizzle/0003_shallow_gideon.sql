ALTER TABLE "keyword_list_items" ADD COLUMN "volume" integer;--> statement-breakpoint
ALTER TABLE "keyword_list_items" ADD COLUMN "kd" integer;--> statement-breakpoint
ALTER TABLE "keyword_list_items" ADD COLUMN "cpc" real;--> statement-breakpoint
ALTER TABLE "keyword_list_items" ADD COLUMN "intent" text;--> statement-breakpoint
ALTER TABLE "keyword_lists" ADD COLUMN "last_enriched_at" timestamp;