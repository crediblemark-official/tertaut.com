-- Harmonize projects vs apps table across databases created by migration journal and schema push
DO $$
DECLARE
  apps_kind "char";
  projects_kind "char";
BEGIN
  SELECT relkind INTO apps_kind FROM pg_class WHERE relname = 'apps' AND relnamespace = 'public'::regnamespace;
  SELECT relkind INTO projects_kind FROM pg_class WHERE relname = 'projects' AND relnamespace = 'public'::regnamespace;

  -- 1. If 'apps' is a real table and 'projects' does not exist, rename 'apps' to 'projects'
  IF apps_kind = 'r' AND projects_kind IS NULL THEN
    ALTER TABLE public.apps RENAME TO projects;
    projects_kind := 'r';
    apps_kind := NULL;
  END IF;

  -- 2. If 'projects' is a table, ensure all required columns exist
  IF projects_kind = 'r' THEN
    ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS "api_key" text DEFAULT '' NOT NULL;
    ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS "app_type" text DEFAULT 'saas_web' NOT NULL;
    ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS "brand_color" text DEFAULT '#0D9488';
    ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS "logo_url" text;
    ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS "app_url" text;
    ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS "is_suspended" boolean DEFAULT false NOT NULL;
    ALTER TABLE public.projects DROP COLUMN IF EXISTS "metering_config";

    CREATE INDEX IF NOT EXISTS "idx_projects_builder_id" ON public.projects ("builder_id");
    CREATE INDEX IF NOT EXISTS "idx_projects_mode" ON public.projects ("mode");
  END IF;

  -- 3. If 'projects' exists and 'apps' does not exist, create a view 'apps' for backward compatibility
  IF projects_kind IS NOT NULL AND apps_kind IS NULL THEN
    CREATE OR REPLACE VIEW public.apps AS SELECT * FROM public.projects;
  END IF;

  -- 4. Clean up deprecated tables
  DROP TABLE IF EXISTS public.credit_ledger CASCADE;
  DROP TABLE IF EXISTS public.ai_app_configs CASCADE;
  DROP TABLE IF EXISTS public.ai_provider_keys CASCADE;
  DROP TABLE IF EXISTS public.ai_proxy_logs CASCADE;
  DROP TABLE IF EXISTS public.ai_usage_logs CASCADE;
  DROP TABLE IF EXISTS public.ai_vault_credentials CASCADE;
END $$;
