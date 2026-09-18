ALTER TABLE "licenses" ADD COLUMN "license_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "features" jsonb DEFAULT '{}'::jsonb;