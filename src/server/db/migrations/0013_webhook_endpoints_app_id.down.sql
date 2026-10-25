DROP INDEX IF EXISTS "idx_webhook_endpoints_app";
ALTER TABLE public.webhook_endpoints DROP COLUMN IF EXISTS "app_id";
