ALTER TABLE "transactions" ADD COLUMN "mode" text DEFAULT 'live' NOT NULL;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "payment_code" text;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "qr_data_url" text;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "payment_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "disbursement_external_id" text;
--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "mode" text DEFAULT 'live' NOT NULL;
--> statement-breakpoint
-- Handle databases created by the migration journal (apps) and by schema push (projects).
DO $$
DECLARE product_table text;
BEGIN
  product_table := CASE WHEN to_regclass('public.projects') IS NOT NULL THEN 'projects' ELSE 'apps' END;
  EXECUTE format('UPDATE transactions t SET mode = p.mode FROM %I p WHERE p.id = t.app_id', product_table);
  EXECUTE format('UPDATE licenses l SET mode = p.mode FROM %I p WHERE p.id = l.app_id', product_table);
END $$;
--> statement-breakpoint
UPDATE "transactions" SET "mode" = 'sandbox'
WHERE "payment_provider" = 'sandbox' OR left("xendit_invoice_id", 12) = 'inv_sandbox_'
   OR left("xendit_external_id", 3) = 'sb_' OR left("xendit_external_id", 5) = 'demo_';
--> statement-breakpoint
UPDATE "licenses" l SET "mode" = t.mode FROM "transactions" t WHERE l.transaction_id = t.id;
--> statement-breakpoint
-- Previously disbursement_id stored the merchant reference instead of the provider id.
UPDATE "transactions" SET "disbursement_external_id" = "disbursement_id"
WHERE "disbursement_id" LIKE 'disb_%' OR "disbursement_id" LIKE 'batch_disb_%';
--> statement-breakpoint
CREATE INDEX "idx_transactions_disbursement_id" ON "transactions" ("disbursement_id");
--> statement-breakpoint
CREATE INDEX "idx_transactions_disbursement_external_id" ON "transactions" ("disbursement_external_id");
