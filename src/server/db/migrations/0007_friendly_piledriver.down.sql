ALTER TABLE "apps" DROP COLUMN IF EXISTS "is_suspended";
ALTER TABLE "builders" DROP COLUMN IF EXISTS "is_suspended";
DROP TABLE IF EXISTS "platform_settings";
