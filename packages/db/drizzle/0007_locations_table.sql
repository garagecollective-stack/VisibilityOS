CREATE TABLE IF NOT EXISTS "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_code" integer NOT NULL,
	"location_name" text NOT NULL,
	"location_type" text NOT NULL,
	"country_iso_code" text NOT NULL,
	"parent_code" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "locations_location_code_unique" UNIQUE("location_code")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_locations_type" ON "locations" ("location_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_locations_parent" ON "locations" ("parent_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_locations_country" ON "locations" ("country_iso_code");
