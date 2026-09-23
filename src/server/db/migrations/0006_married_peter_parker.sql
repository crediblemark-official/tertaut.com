DROP INDEX "idx_transactions_xendit_ext_id";--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_transactions_xendit_ext_id" ON "transactions" USING btree ("xendit_external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_transactions_trial_per_app_email" ON "transactions" USING btree ("app_id","customer_email","payment_channel") WHERE "transactions"."payment_channel" = 'FREE_TRIAL';--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_credit_ledger_license_ref" ON "credit_ledger" USING btree ("license_id","reference");