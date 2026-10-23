-- Preserve historical transaction/operation provider references.
ALTER TABLE "transactions" ALTER COLUMN "payment_provider" SET DEFAULT 'xendit';
--> statement-breakpoint
UPDATE "platform_settings" SET "value" = 'xendit', "updated_at" = now()
WHERE "key" = 'active_payment_gateway' AND "value" NOT IN ('xendit', 'sandbox');
--> statement-breakpoint
DELETE FROM "platform_settings" WHERE "key" LIKE 'dana\_%' ESCAPE '\' OR "key" LIKE 'xenithpay\_%' ESCAPE '\';
