import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { config } from "../config";

const databaseUrl = config.database.url;

function resolveSsl(url: string): boolean | "require" {
  if (process.env.DATABASE_SSL === "false" || url.includes("sslmode=disable")) {
    return false;
  }
  if (
    process.env.DATABASE_SSL === "true" ||
    url.includes("sslmode=require") ||
    url.includes("sslmode=verify-full")
  ) {
    return "require";
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    // Internal Docker/local hosts: localhost, 127.0.0.1, or container hostnames without dots
    if (
      !host ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      !host.includes(".") ||
      host.endsWith(".internal") ||
      host.endsWith(".local") ||
      host.endsWith(".docker")
    ) {
      return false;
    }
  } catch {}

  return config.isProd ? "require" : false;
}

const useSsl = resolveSsl(databaseUrl);

export const queryClient = postgres(databaseUrl, {
  max: 3,
  idle_timeout: 15,
  connect_timeout: 5,
  ssl: useSsl,
  onnotice: () => {},
});

export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
