import { readFileSync } from "fs";
import { resolve } from "path";
import { queryClient } from "./index";
import { logger } from "../lib/logger";

async function runRollback() {
  logger.info("Memulai rollback skema database Tertaut (down.sql)...");
  try {
    const downSqlPath = resolve(import.meta.dir, "migrations/down.sql");
    const sql = readFileSync(downSqlPath, "utf-8");
    await queryClient.unsafe(sql);
    logger.info("Rollback skema database berhasil diaplikasikan 100%!");
  } catch (error) {
    logger.error("Rollback database gagal", error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

runRollback();
