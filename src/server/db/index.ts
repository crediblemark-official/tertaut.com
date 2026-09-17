import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { config } from "../config";

const databaseUrl = config.database.url;

const useSsl =
  process.env.DATABASE_SSL === "true" ||
  (config.isProd && !databaseUrl.includes("localhost") && !databaseUrl.includes("127.0.0.1"));

// Connection pool for PostgreSQL
export const queryClient = postgres(databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: useSsl ? "require" : false,
  onnotice: () => {},
});

export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
