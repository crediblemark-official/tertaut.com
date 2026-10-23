import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { apiV1Routes } from "./routes/api";
import { badgeRoutes } from "./routes/badge/router";
import { webhookRoutes, webhooksPluralRoutes } from "./routes/webhook/router";
import { checkoutRoutes } from "./routes/checkout/router";
import { config, resolveRequestOrigin } from "./config";
import { auth } from "./auth";
import { LicenseTokenService } from "./services/licensing/licenseToken";
import { startScheduledTasks } from "./tasks/scheduler";
import { ensureDemoData } from "./db/ensureDemo";
import { ensurePlatformSettings } from "./db/ensureSettings";
import { generateDynamicSitemap } from "./routes/seo/sitemap";
import { logger } from "./lib/logger";
import { configureSwagger } from "./lib/swagger";
import { staticSpaRoutes } from "./middleware/staticSpa";
import { runAutoMigrations } from "./bootstrap/migrations";
import { ensurePlatformAdmin, ensureFirstUserIsAdmin } from "./bootstrap/admin";

export { ensurePlatformAdmin, ensureFirstUserIsAdmin };

export const app = new Elysia()
  // Deteksi otomatis domain yang sedang dipakai oleh klien/browser
  .onRequest(({ request }) => {
    resolveRequestOrigin(request);
  })
  // Secure CORS: Only allow trusted origins with credentials
  .use(
    cors({
      origin: (request: Request) => {
        const origin = request.headers.get("origin");

        // Allow any origin for public embeddable endpoints (widgets, embed scripts, badges)
        try {
          const url = new URL(request.url);
          if (
            url.pathname.includes("/embed.js") ||
            url.pathname.startsWith("/api/v1/badge") ||
            url.pathname.startsWith("/badge")
          ) {
            return true;
          }
        } catch {
          // URL request tidak dapat diparse, lanjut ke pemeriksaan origin berikutnya
        }

        // Request tanpa header Origin (same-origin, cURL, s2s) atau Origin "null" (sandboxed iframe)
        // TIDAK boleh memicu refleksi CORS wildcard dengan credentials:true.
        if (!origin || origin === "null") return false;

        const detected = resolveRequestOrigin(request);
        if (detected) {
          try {
            if (origin === new URL(detected).origin) return true;
          } catch {
            // URL origin terdeteksi tidak valid
          }
        }

        // Regex DIN-ANCHOR (^...$): mencegah origin tiruan yang hanya "berakhiran"
        // tertaut.com (mis. https://evil-tertaut.com) lolos pemeriksaan.
        const allowedPatterns = [
          /^https?:\/\/localhost(:\d+)?$/,
          /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
          /^https:\/\/([a-z0-9-]+\.)*tertaut\.com(:\d+)?$/,
        ];
        if (config.publicAppUrl) {
          try {
            if (origin === new URL(config.publicAppUrl).origin) return true;
          } catch {
            // config.publicAppUrl bukan URL origin valid
          }
        }
        if (config.publicStoreUrl) {
          try {
            if (origin === new URL(config.publicStoreUrl).origin) return true;
          } catch {
            // config.publicStoreUrl bukan URL origin valid
          }
        }
        return allowedPatterns.some((pattern) => pattern.test(origin));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
  )
  // HTTP Security Headers
  .onAfterHandle(({ request, set }) => {
    set.headers["X-Content-Type-Options"] = "nosniff";
    set.headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    set.headers["X-XSS-Protection"] = "0";

    // Request ID Tracing
    const reqId = request?.headers?.get("x-request-id") || crypto.randomUUID();
    set.headers["X-Request-Id"] = reqId;

    const url = request?.url ? new URL(request.url) : null;
    const isEmbedPath =
      url &&
      (url.pathname.includes("/embed.js") ||
        url.pathname.startsWith("/api/v1/badge") ||
        url.pathname.startsWith("/badge"));

    if (!isEmbedPath) {
      set.headers["X-Frame-Options"] = "SAMEORIGIN";
    }

    if (config.isProd) {
      set.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
    }
  })

  // Interactive Swagger / OpenAPI Documentation
  .use(configureSwagger())

  .onError(({ code, error, set, path }) => {
    if (path.startsWith("/api/auth/")) return;

    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: { code: "NOT_FOUND", message: `Endpoint ${path} tidak ditemukan` } };
    }
    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: { code: "VALIDATION_ERROR", message: error.message, details: (error as any).all },
      };
    }

    const resolvedStatus = (error as any).status || set.status;
    const finalStatus =
      typeof resolvedStatus === "number" && resolvedStatus >= 400 ? resolvedStatus : 500;
    set.status = finalStatus;

    const errorMessage =
      (error as any)?.message || String(error) || "Terjadi kesalahan internal server.";
    if (finalStatus >= 500) {
      logger.error(`[Server Error ${finalStatus}] ${path}: ${errorMessage}`, error);
    }
    return {
      error: {
        code: typeof code === "string" ? code : "INTERNAL_ERROR",
        message: errorMessage,
      },
    };
  })

  // Better Auth handler (sign-in/up, session) di /api/auth/*
  .get("/api/auth/*", async ({ request }) => {
    try {
      return await auth.handler(request);
    } catch (err: any) {
      console.error(`[Auth Exception] GET ${request.url}:`, err?.message || err);
      throw err;
    }
  })
  .post("/api/auth/*", async ({ request }) => {
    try {
      const res = await auth.handler(request);
      if (res.status >= 500) {
        console.error(`[Auth] POST ${request.url} failed with status ${res.status}`);
        try {
          const clone = res.clone();
          const body = await clone.text();
          console.error(`[Auth Response Body]`, body);
        } catch (bodyErr: any) {
          console.error(
            `[Auth Response Body] Gagal membaca clone body:`,
            bodyErr?.message || bodyErr
          );
        }
      }
      return res;
    } catch (err: any) {
      console.error(`[Auth Exception] POST ${request.url}:`, err?.message || err);
      throw err;
    }
  })
  .all("/api/auth/*", async ({ request }) => {
    try {
      return await auth.handler(request);
    } catch (err: any) {
      console.error(`[Auth Exception] ${request.method} ${request.url}:`, err?.message || err);
      throw err;
    }
  })

  // Public key Ed25519 untuk verifikasi offline license token (tanpa shared secret)
  .get("/.well-known/jwks.json", () => LicenseTokenService.getJwks())
  .get("/.well-known/license-public-key.pem", ({ set }) => {
    set.headers["content-type"] = "text/plain; charset=utf-8";
    return LicenseTokenService.getPublicKeyPem();
  })

  // Mount API v1 Routes & Direct Badge Endpoint
  .use(apiV1Routes)
  .use(badgeRoutes)
  // Mount webhook aliases
  .use(webhookRoutes)
  .use(webhooksPluralRoutes)
  .use(checkoutRoutes)

  // Dynamic Programmatic Sitemap (Auto-sync DB Apps & Static Pages)
  .get("/sitemap.xml", async ({ set }) => {
    set.headers["content-type"] = "application/xml; charset=utf-8";
    set.headers["cache-control"] = "public, max-age=3600, s-maxage=86400";
    return await generateDynamicSitemap();
  })

  // Mount Static Assets & SPA Fallback
  .use(staticSpaRoutes);

if (!config.isTest) {
  await runAutoMigrations();
  await ensurePlatformAdmin();
  await ensurePlatformSettings();
  if (!config.isProd) {
    await ensureDemoData();
  }

  const scheduledTasks = startScheduledTasks();

  const serverInstance = app.listen(config.port, () => {
    console.log(`\n🚀 tertaut.com Engine is running at http://localhost:${config.port}`);
    console.log(`📖 Interactive Swagger Docs: http://localhost:${config.port}/swagger`);
    console.log(`⚡ Runtime: Bun ${Bun.version} | Single Container Architecture ready\n`);
  });

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Menerima sinyal ${signal}. Memulai proses graceful shutdown...`);
    scheduledTasks.stop();

    try {
      serverInstance.stop();
      const { queryClient } = await import("./db");
      await queryClient.end();
      console.log("✅ Koneksi server dan database PostgreSQL berhasil ditutup.");
      process.exit(0);
    } catch (err) {
      console.error("❌ Gagal saat graceful shutdown:", err);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

export type App = typeof app;
