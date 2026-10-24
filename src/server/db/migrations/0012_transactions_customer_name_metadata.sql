ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "customer_name" text;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
