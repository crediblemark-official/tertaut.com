import { existsSync } from "fs";
import { resolve } from "path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";

/**
 * Jalankan migrasi skema database secara otomatis pada startup jika tabel belum ada,
 * serta memastikan tabel projects dan view apps harmonis di seluruh database.
 */
export async function runAutoMigrations(): Promise<void> {
  try {
    const migrationsFolder = resolve(import.meta.dir, "../db/migrations");
    if (existsSync(migrationsFolder)) {
      console.log("[DB] Memeriksa dan menjalankan migrasi skema database...");
      await migrate(db, { migrationsFolder });
      console.log("[DB] Migrasi skema database berhasil diaplikasikan!");
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[DB] Migrasi database gagal:", msg);
    if (process.env.NODE_ENV === "production") {
      throw new Error(`[DB] Startup halted: Migrasi skema database gagal: ${msg}`);
    }
  }

  // Idempotent safeguard: Pastikan tabel projects & view apps harmonis di semua database/environment
  try {
    await db.execute(sql`
      DO $$
      DECLARE
        apps_kind "char";
        projects_kind "char";
      BEGIN
        SELECT relkind INTO apps_kind FROM pg_class WHERE relname = 'apps' AND relnamespace = 'public'::regnamespace;
        SELECT relkind INTO projects_kind FROM pg_class WHERE relname = 'projects' AND relnamespace = 'public'::regnamespace;

        IF apps_kind = 'r' AND projects_kind IS NULL THEN
          ALTER TABLE public.apps RENAME TO projects;
          projects_kind := 'r';
          apps_kind := NULL;
        END IF;

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

        IF projects_kind IS NOT NULL AND apps_kind IS NULL THEN
          CREATE OR REPLACE VIEW public.apps AS SELECT * FROM public.projects;
        END IF;
      END $$;
    `);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[DB] Safeguard harmonisasi projects/apps:", msg);
  }
}
