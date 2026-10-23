CREATE TABLE "payment_operations" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "provider" text NOT NULL,
  "transaction_ids" jsonb NOT NULL,
  "amount" integer NOT NULL,
  "request" jsonb NOT NULL,
  "status" text NOT NULL,
  "provider_id" text,
  "last_error" text,
  "next_check_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_payment_operations_reconcile" ON "payment_operations" ("status", "next_check_at");
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "refund_status" text DEFAULT 'NONE' NOT NULL;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "refund_operation_id" text;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "payout_operation_id" text;
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD COLUMN "event_id" text;
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD COLUMN "claim_token" text;
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD COLUMN "locked_until" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "unique_webhook_event_endpoint" UNIQUE ("event_id", "endpoint_id");
