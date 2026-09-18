-- Migration 0004: Add app pricing, billing, and delivery columns if not exists
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "pricing_type" text DEFAULT 'one_time' NOT NULL;
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "billing_period" text;
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "trial_period_days" integer DEFAULT 0;
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "delivery_config" jsonb;
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "metering_config" jsonb;
