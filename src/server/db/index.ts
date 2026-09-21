import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { config } from "../config";

const databaseUrl = config.database.url;

const useSsl =
  process.env.DATABASE_SSL === "false" || databaseUrl.includes("sslmode=disable")
    ? false
    : process.env.DATABASE_SSL === "true" ||
      databaseUrl.includes("sslmode=require") ||
      (config.isProd &&
        !databaseUrl.includes("localhost") &&
        !databaseUrl.includes("127.0.0.1") &&
        !databaseUrl.includes("@postgres:") &&
        !databaseUrl.includes("@postgres/"));

export const queryClient = postgres(databaseUrl, {
  max: 3,
  idle_timeout: 15,
  connect_timeout: 5,
  ssl: useSsl ? "require" : false,
});

export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
