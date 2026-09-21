import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "./db";
import { config } from "./config";
import { user, session, account, verification } from "./db/schema";

const trustedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "https://tertaut.com",
  "http://tertaut.com",
  "https://*.tertaut.com",
  "http://*.tertaut.com",
  config.publicAppUrl,
  config.publicStoreUrl,
].filter(Boolean);

export const auth = betterAuth({
  appName: "tertaut.com",
  secret: config.security.betterAuthSecret,
  baseURL: config.publicAppUrl,
  basePath: "/api/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  trustedOrigins,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 hari
    updateAge: 60 * 60 * 24, // refresh harian
  },
  advanced: {
    trustedProxyHeaders: true,
    // Jangan pakai Secure/__Secure- cookie di development (proxy http localhost).
    useSecureCookies: config.isProd,
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: config.isProd,
    },
  },
  plugins: [admin()],
});

export type Auth = typeof auth;
