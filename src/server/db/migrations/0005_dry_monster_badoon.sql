ALTER TABLE "transactions" ALTER COLUMN "payment_provider" SET DEFAULT 'dana';--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "mock_order" boolean DEFAULT false NOT NULL;