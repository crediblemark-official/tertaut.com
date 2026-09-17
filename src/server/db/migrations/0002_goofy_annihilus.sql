ALTER TABLE "apps" ALTER COLUMN "mode" SET DEFAULT 'sandbox';--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "payment_provider" text DEFAULT 'xendit' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "provider_reference_id" text;