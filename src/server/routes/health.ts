import { Elysia } from "elysia";
import { queryClient } from "../db";
import packageJson from "../../../package.json";

export const healthRoutes = new Elysia({ prefix: "/health" }).get(
  "/",
  async () => {
    let dbStatus = "unknown";
    let tables: string[] = [];
    try {
      const rows = await queryClient<{ table_name: string }[]>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
      dbStatus = "connected";
      tables = rows.map((r) => r.table_name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      dbStatus = `error: ${msg}`;
    }

    return {
      status: "ok",
      version: "2.3.0",
      timestamp: new Date().toISOString(),
      db: {
        status: dbStatus,
        tableCount: tables.length,
        hasUserTable: tables.includes("user"),
        hasAppsTable: tables.includes("apps"),
        tables,
      },
    };
  },
  {
    detail: {
      tags: ["System"],
      summary: "Health Check",
      description: "Returns the health and operational status of tertaut.com engine",
    },
  }
);
