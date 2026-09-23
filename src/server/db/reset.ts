import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, queryClient } from "./index";
import { seed } from "./seed";

export async function resetDatabase() {
  console.log("🧨 [DB Reset] Mengosongkan skema database PostgreSQL...");
  try {
    // Drop skema drizzle & public beserta seluruh tabel dan relasi cascade
    await queryClient.unsafe(`
      DROP SCHEMA IF EXISTS drizzle CASCADE;
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);
    console.log("✅ [DB Reset] Skema database berhasil dikosongkan.");

    // Terapkan seluruh migrasi skema Drizzle dari awal
    console.log("📦 [DB Reset] Mengaplikasikan migrasi skema database Drizzle...");
    await migrate(db, { migrationsFolder: "./src/server/db/migrations" });
    console.log("✅ [DB Reset] Migrasi skema database berhasil diaplikasikan!");

    // Masukkan data awal (seed) yang rapi
    console.log("🌱 [DB Reset] Mengisi data seed awal...");
    await seed();
    console.log("🎉 [DB Reset] Database berhasil di-reset dan di-seed 100%!");
  } catch (error: any) {
    console.error("❌ [DB Reset] Gagal mereset database:", error?.message || error);
    throw error;
  }
}

if (import.meta.main) {
  resetDatabase()
    .then(async () => {
      await queryClient.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await queryClient.end();
      process.exit(1);
    });
}
