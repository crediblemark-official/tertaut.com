import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, queryClient } from "./index";

async function runMigrations() {
  console.log("Running pending migrations on PostgreSQL...");
  try {
    await migrate(db, { migrationsFolder: "./src/server/db/migrations" });
    console.log("Migrations applied successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

runMigrations();
