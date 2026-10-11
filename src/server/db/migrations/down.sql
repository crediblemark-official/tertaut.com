-- Tertaut Complete Schema Rollback Script (Reverse Order: 0007 down to 0000)

-- 0007_friendly_piledriver.down
ALTER TABLE "apps" DROP COLUMN IF EXISTS "is_suspended";
ALTER TABLE "builders" DROP COLUMN IF EXISTS "is_suspended";
DROP TABLE IF EXISTS "platform_settings";

-- 0006_married_peter_parker.down
DROP INDEX IF EXISTS "uniq_credit_ledger_license_ref";
DROP INDEX IF EXISTS "uniq_transactions_trial_per_app_email";
DROP INDEX IF EXISTS "uniq_transactions_xendit_ext_id";
CREATE INDEX IF NOT EXISTS "idx_transactions_xendit_ext_id" ON "transactions" USING btree ("xendit_external_id");

-- 0005_dry_monster_badoon.down
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "mock_order";
ALTER TABLE "transactions" ALTER COLUMN "payment_provider" SET DEFAULT 'xendit';

-- 0004_polite_sinister_six.down
DROP TABLE IF EXISTS "webhook_deliveries" CASCADE;
DROP TABLE IF EXISTS "webhook_endpoints" CASCADE;
DROP TABLE IF EXISTS "license_leases" CASCADE;
DROP TABLE IF EXISTS "license_events" CASCADE;

-- 0003_volatile_miracleman.down
ALTER TABLE "licenses" DROP COLUMN IF EXISTS "features";
ALTER TABLE "licenses" DROP COLUMN IF EXISTS "license_version";

-- 0002_magical_morph.down
ALTER TABLE "builders" DROP COLUMN IF EXISTS "secret_api_key";

-- 0001_plain_namora.down
ALTER TABLE "apps" DROP COLUMN IF EXISTS "api_key";

-- 0000_shallow_venus.down
DROP TABLE IF EXISTS "audit_events" CASCADE;
DROP TABLE IF EXISTS "credit_ledger" CASCADE;
DROP TABLE IF EXISTS "revoked_tokens" CASCADE;
DROP TABLE IF EXISTS "license_activations" CASCADE;
DROP TABLE IF EXISTS "licenses" CASCADE;
DROP TABLE IF EXISTS "coupons" CASCADE;
DROP TABLE IF EXISTS "transactions" CASCADE;
DROP TABLE IF EXISTS "apps" CASCADE;
DROP TABLE IF EXISTS "builders" CASCADE;
DROP TABLE IF EXISTS "verification" CASCADE;
DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS "account" CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;
