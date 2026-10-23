-- Revert projects table back to apps if needed
DROP VIEW IF EXISTS public.apps CASCADE;
DO $$
BEGIN
  IF to_regclass('public.projects') IS NOT NULL AND to_regclass('public.apps') IS NULL THEN
    ALTER TABLE public.projects RENAME TO apps;
  END IF;
END $$;
