DROP INDEX IF EXISTS "idx_transactions_disbursement_external_id";
DROP INDEX IF EXISTS "idx_transactions_disbursement_id";
ALTER TABLE "transactions" DROP COLUMN "disbursement_external_id";
ALTER TABLE "transactions" DROP COLUMN "payment_expires_at";
ALTER TABLE "transactions" DROP COLUMN "qr_data_url";
ALTER TABLE "transactions" DROP COLUMN "payment_code";
ALTER TABLE "transactions" DROP COLUMN "mode";
ALTER TABLE "licenses" DROP COLUMN "mode";
