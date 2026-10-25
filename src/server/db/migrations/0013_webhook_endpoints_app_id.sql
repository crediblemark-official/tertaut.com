ALTER TABLE public.webhook_endpoints ADD COLUMN IF NOT EXISTS "app_id" text REFERENCES public.projects("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "idx_webhook_endpoints_app" ON public.webhook_endpoints ("app_id");
