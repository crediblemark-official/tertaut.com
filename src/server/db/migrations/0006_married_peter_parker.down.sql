DROP INDEX IF EXISTS "uniq_credit_ledger_license_ref";
DROP INDEX IF EXISTS "uniq_transactions_trial_per_app_email";
DROP INDEX IF EXISTS "uniq_transactions_xendit_ext_id";
CREATE INDEX IF NOT EXISTS "idx_transactions_xendit_ext_id" ON "transactions" USING btree ("xendit_external_id");
