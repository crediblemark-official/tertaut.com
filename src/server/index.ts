import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";
import { apiV1Routes } from "./routes/api";
import { badgeRoutes } from "./routes/badge/router";
import { webhookRoutes, webhooksPluralRoutes, snapBiWebhookRoutes } from "./routes/webhook/router";
import { checkoutRoutes } from "./routes/checkout/router";
import { config, resolveRequestOrigin } from "./config";
import { auth } from "./auth";
import { LicenseTokenService } from "./services/licensing/licenseToken";
import { existsSync, statSync } from "fs";
import { resolve } from "path";
import { db } from "./db";
import { user, account } from "./db/schema";
import { eq, and, asc } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { startScheduledTasks } from "./tasks/scheduler";
import { ensureDemoData } from "./db/ensureDemo";
import { ensurePlatformSettings } from "./db/ensureSettings";
import { randomBytes } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { generateDynamicSitemap } from "./routes/seo/sitemap";
import { isCrawler, resolveMetadataForPath, injectDynamicSeo } from "./services/seo/seoPrerender";

const clientDistPath = resolve(import.meta.dir, "../../dist");
const docsDistPath = resolve(clientDistPath, "docs");
const isProduction = process.env.NODE_ENV === "production";
const hasBuiltClient = isProduction && existsSync(clientDistPath);

/** Kirim file dari dalam folder dist (docs) dengan sanitasi path traversal */
function serveFromDir(dir: string, pathname: string, set: any): any | { error: string } {
  const safePath = decodeURIComponent(pathname).replace(/\.\.+[/\\]/g, "");
  let targetFile = resolve(dir, "." + safePath);

  if (targetFile.startsWith(dir) && existsSync(targetFile) && !statSync(targetFile).isDirectory()) {
    return Bun.file(targetFile);
  }

  // Fallback halaman tanpa ekstensi (misal /docs/sdk):
  if (!safePath.split("/").pop()?.includes(".")) {
    targetFile = resolve(dir, "." + safePath + ".html");
    if (
      targetFile.startsWith(dir) &&
      existsSync(targetFile) &&
      !statSync(targetFile).isDirectory()
    ) {
      return Bun.file(targetFile);
    }
  }

  set.status = 404;
  return { error: "Not Found" };
}

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
        // Request tanpa header Origin (same-origin GET, curl, navigasi) diizinkan.
        // Origin "null" (sandboxed iframe / data: URL) DITOLAK — kombinasi dengan
        // credentials:true memperluas permukaan CSRF/cross-origin read.
        if (!origin) return true;
        if (origin === "null") return false;

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

    // Request ID Tracing (Item 13)
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
  .use(
    swagger({
      path: "/swagger",
      provider: "swagger-ui",
      exclude: [
        // Internal admin panel (hanya untuk dashboard internal, bukan API builder)
        /^\/api\/v1\/panel/,
        /^\/panel/,
        // Webhook callback (server-to-server, bukan untuk builder)
        /^\/webhook/,
        /^\/webhooks/,
        /^\/api\/v1\/webhook/,
        /^\/api\/v1\/webhooks/,
        /^\/api\/v1\/checkout\/webhook/,
        // Duplikat root-level (path kanonik sudah di /api/v1/...)
        /^\/checkout\//,
        /^\/badge\//,
        // Alias legacy duplikat
        /^\/api\/v1\/license\//,
        /^\/api\/v1\/ai-proxy/,
        // Internal vault kredensial AI
        /^\/api\/v1\/ai\/vault/,
        // Manajemen aplikasi via dashboard (kelola lewat UI; programatik pakai S2S)
        /^\/api\/v1\/apps\/$/,
        /^\/api\/v1\/apps\/[^/]+$/,
        /^\/api\/v1\/apps\/stats/,
        /^\/api\/v1\/apps\/check-slug/,
        /^\/api\/v1\/apps\/me/,
        /^\/api\/v1\/apps\/rotate-secret-api-key/,
        /^\/api\/v1\/apps\/[^/]+\/rotate-api-key/,
        /^\/api\/v1\/apps\/[^/]+\/mode/,
        /^\/api\/v1\/apps\/disburse/,
        // Operasi uang & dashboard checkout (bukan konsumen external)
        /^\/api\/v1\/checkout\/transactions/,
        /^\/api\/v1\/checkout\/disburse/,
        /^\/api\/v1\/payouts/,
        // Manajemen kupon via dashboard
        /^\/api\/v1\/coupons/,
        // Launch kit dashboard
        /^\/api\/v1\/launch/,
        // Statistik metering dashboard
        /^\/api\/v1\/metering\/stats/,
        // Konfigurasi & log AI Shield dashboard
        /^\/api\/v1\/ai\/configs/,
        /^\/api\/v1\/ai\/logs/,
        // Admin lisensi dashboard (programatik: S2S /licenses/issue|revoke)
        /^\/api\/v1\/licensing\/list/,
        /^\/api\/v1\/licensing\/issue/,
        /^\/api\/v1\/licensing\/revoke/,
        /^\/api\/v1\/licensing\/unbind-hardware/,
        /^\/api\/v1\/licensing\/renew/,
        /^\/api\/v1\/licensing\/seats/,
        /^\/api\/v1\/licensing\/events/,
        /^\/api\/v1\/licensing\/webhooks/,
        // Endpoint internal yang tidak dipakai SDK/docs (bukan API builder)
        /^\/api\/v1\/health\//,
        /^\/api\/v1\/apps\/by-slug\//,
        /^\/api\/v1\/checkout\/dana\/finish/,
        /^\/api\/v1\/checkout\/preview-coupon/,
        /^\/api\/v1\/metering\/events/,
        /^\/api\/v1\/metering\/usage\//,
        // Internal banner pengumuman frontend
        /^\/api\/v1\/announcement/,
      ],
      documentation: {
        info: {
          title: "tertaut.com Developer API",
          version: "0.2.0",
          description:
            "Spesifikasi OpenAPI resmi untuk platform **tertaut.com** — Merchant of Record (MoR), Lisensi Kriptografis Offline-First (Ed25519), dan AI Proxy Shield untuk software builder di Indonesia.\n\n" +
            "### 🛡️ Skema Autentikasi:\n" +
            "- **`BuilderSecretKey` (`Bearer tt_secret_...`)**: Wajib untuk seluruh endpoint Server-to-Server (`/api/v1/s2s/*`). Ambil secret key Anda di halaman Dashboard > Docs. Jangan pernah mengekspos secret key ini di aplikasi klien/frontend.\n" +
            "- **`LicenseToken` (`Bearer <token>`)**: Digunakan oleh perangkat klien setelah aktivasi lisensi (`POST /api/v1/licensing/activate`) untuk mengakses AI Proxy Shield dan membuktikan kepemilikan lisensi secara offline.\n\n" +
            "### 📦 Integrasi SDK Resmi:\n" +
            "Gunakan library resmi [`@tertaut/sdk`](https://www.npmjs.com/package/@tertaut/sdk) (`npm install @tertaut/sdk`) untuk TypeScript/JavaScript, browser, Bun, Node.js, Tauri, dan Electron.",
        },
        tags: [
          {
            name: "MoR Checkout",
            description:
              "Alur pembayaran Merchant of Record (QRIS & Virtual Account), e-receipt resmi (PPN 11%), kupon diskon, dan status polling.",
          },
          {
            name: "Universal Licensing",
            description:
              "Validasi lisensi multi-platform, binding hardware ID perangkat, aktivasi floating seat, dan token offline Ed25519.",
          },
          {
            name: "AI API Proxy Shield",
            description:
              "Gateway AI aman tanpa kebocoran master API key, dilengkapi proteksi rate limit, daily token cap, dan relay SSE streaming.",
          },
          {
            name: "Credits",
            description:
              "Ledger saldo kredit dan pelaporan pemakaian konsumsi kredit lisensi secara atomik dan idempoten.",
          },
          {
            name: "S2S API",
            description:
              "Endpoint Server-to-Server terproteksi secret API key untuk otomasi backend (issuance, revoke, batch ops, transfer, webhooks).",
          },
          {
            name: "Launch Kit",
            description:
              "Web component trust badge embeddable dan widget penjualan penambah konversi.",
          },
        ],
        components: {
          securitySchemes: {
            BuilderSecretKey: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
              description:
                "Secret API key builder (tt_secret_...) dari halaman Dashboard Docs. Wajib untuk seluruh endpoint Server-to-Server (/api/v1/s2s/*). Jangan pernah simpan di frontend.",
            },
            LicenseToken: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
              description:
                "Offline license token (JWT) hasil POST /api/v1/licensing/activate — atau sertakan licenseKey di body/query. Wajib untuk AI API Proxy Shield.",
            },
          },
        },
      },
    })
  )

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
      console.error(`[Server Error ${finalStatus}] ${path}:`, errorMessage);
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
  // Mount Direct Webhook & Checkout Root Endpoints (e.g. /webhook/dana/finish-payment, /v1.0/debit/notify)
  .use(webhookRoutes)
  .use(webhooksPluralRoutes)
  .use(snapBiWebhookRoutes)
  .use(checkoutRoutes)

  // Dynamic Programmatic Sitemap (Auto-sync DB Apps & Static Pages)
  .get("/sitemap.xml", async ({ set }) => {
    set.headers["content-type"] = "application/xml; charset=utf-8";
    set.headers["cache-control"] = "public, max-age=3600, s-maxage=86400";
    return await generateDynamicSitemap();
  });

// Production: Single Container Monolith serves built SPA assets from dist/
if (hasBuiltClient) {
  const serveDocsIndex = () => {
    const indexPath = resolve(docsDistPath, "index.html");
    if (existsSync(indexPath)) {
      return Bun.file(indexPath);
    }
    return { error: "Docs belum di-build (jalankan: bun run build:docs)" };
  };

  app
    // VitePress /docs (base: /docs/)
    .get("/docs", ({ set }) => {
      set.status = 301;
      set.headers["location"] = "/docs/";
      return {};
    })
    .get("/docs/", serveDocsIndex)
    .get("/docs/*", ({ request, set }) =>
      serveFromDir(docsDistPath, new URL(request.url).pathname.slice("/docs".length), set)
    )
    .get("/checkout/dana/finish", ({ query, set }: any) => {
      const qs = new URLSearchParams(query as any).toString();
      set.redirect = `/api/v1/checkout/dana/finish${qs ? `?${qs}` : ""}`;
    })
    // SPA fallback
    .get("*", async ({ request, set }) => {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        set.status = 404;
        return { error: `Endpoint API ${url.pathname} tidak ditemukan` };
      }
      const decodedPath = decodeURIComponent(url.pathname);
      // Sanitize path traversal attempts
      const safePath = decodedPath.replace(/\.\.+[/\\]/g, "");

      // Sajikan robots.txt, llms.txt, & llms-full.txt dengan header text/plain
      if (
        url.pathname === "/robots.txt" ||
        url.pathname === "/llms.txt" ||
        url.pathname === "/llms-full.txt"
      ) {
        const fileName = url.pathname.slice(1);
        const txtFile = resolve(clientDistPath, fileName);
        if (existsSync(txtFile)) {
          set.headers["content-type"] = "text/plain; charset=utf-8";
          return Bun.file(txtFile);
        }
      }

      // Sajikan .well-known/ai-catalog.json dengan header application/json
      if (url.pathname === "/.well-known/ai-catalog.json") {
        const catalogFile = resolve(clientDistPath, ".well-known/ai-catalog.json");
        if (existsSync(catalogFile)) {
          set.headers["content-type"] = "application/json; charset=utf-8";
          return Bun.file(catalogFile);
        }
      }

      const targetFile = resolve(clientDistPath, "." + safePath);

      // Ensure resolved path is strictly within clientDistPath
      if (
        targetFile.startsWith(clientDistPath) &&
        existsSync(targetFile) &&
        !statSync(targetFile).isDirectory()
      ) {
        return Bun.file(targetFile);
      }

      const indexPath = resolve(clientDistPath, "index.html");
      if (existsSync(indexPath)) {
        set.headers["content-type"] = "text/html; charset=utf-8";
        try {
          const rawHtml = await Bun.file(indexPath).text();
          const userAgent = request.headers.get("user-agent");
          const meta = await resolveMetadataForPath(url.pathname);
          return injectDynamicSeo(rawHtml, meta, { isCrawler: isCrawler(userAgent) });
        } catch {
          return Bun.file(indexPath);
        }
      }
      set.status = 404;
      return { error: "Not Found" };
    });
} else {
  // Development: Port 8081 is strictly Backend API & Swagger
  app.get("*", ({ request, set }) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      set.status = 404;
      return { error: `Endpoint API ${url.pathname} tidak ditemukan` };
    }
    if (url.pathname === "/") {
      return {
        service: "tertaut.com Engine Backend API",
        port: config.port,
        mode: "development",
        endpoints: {
          swagger: `http://localhost:${config.port}/swagger`,
          docs: "http://localhost:5173/docs",
          health: `http://localhost:${config.port}/api/v1/health`,
        },
        notice: "Frontend UI is running on Vite Dev Server: http://localhost:5173",
      };
    }
    // Redirect accidental frontend route visits to Vite dev server
    return Response.redirect(`http://localhost:5173${url.pathname}${url.search}`, 302);
  });
}

/** Jalankan migrasi skema database secara otomatis pada startup jika tabel belum ada */
async function runAutoMigrations(): Promise<void> {
  try {
    const migrationsFolder = resolve(import.meta.dir, "db/migrations");
    if (existsSync(migrationsFolder)) {
      console.log("[DB] Memeriksa dan menjalankan migrasi skema database...");
      await migrate(db, { migrationsFolder });
      console.log("[DB] Migrasi skema database berhasil diaplikasikan!");
    }
  } catch (error: any) {
    console.error("[DB] Migrasi database gagal:", error?.message || error);
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `[DB] Startup halted: Migrasi skema database gagal: ${error?.message || error}`
      );
    }
  }
}

/**
 * Pastikan akun admin platform (platformtertaut@gmail.com atau ADMIN_EMAIL)
 * memiliki role "admin" dan emailVerified: true.
 * Akun lain tidak boleh dipromosikan otomatis hanya karena terdaftar pertama.
 */
export async function ensurePlatformAdmin(): Promise<void> {
  try {
    const adminEmail = (
      config.admin.email ||
      process.env.ADMIN_EMAIL ||
      "platformtertaut@gmail.com"
    ).toLowerCase();
    let platformUser = await db.query.user.findFirst({
      where: eq(user.email, adminEmail),
    });

    if (!platformUser) {
      const adminPassword =
        config.admin.password ||
        (config.isTest ? "TestAdminPass123!" : `Sec_${randomBytes(16).toString("hex")}!Aa1`);

      if (!config.admin.password && !config.isTest) {
        console.warn(
          `[Auth] PERINGATAN: ADMIN_PASSWORD tidak disetel di environment. Password awal yang di-generate: ${adminPassword}`
        );
      }

      try {
        await auth.api.signUpEmail({
          body: {
            email: adminEmail,
            password: adminPassword,
            name: "Platform Tertaut",
          },
        });
        platformUser = await db.query.user.findFirst({
          where: eq(user.email, adminEmail),
        });
      } catch (err: any) {
        console.warn("[Auth] Gagal inisialisasi akun platform admin:", err?.message || err);
      }
    }

    if (platformUser && (platformUser.role !== "admin" || !platformUser.emailVerified)) {
      await db
        .update(user)
        .set({ role: "admin", emailVerified: true })
        .where(eq(user.id, platformUser.id));
      console.log(`[Auth] Akun platform (${adminEmail}) dipastikan sebagai admin.`);
    }

    if (platformUser && config.admin.password) {
      const hashedPassword = await hashPassword(config.admin.password);
      const existingAccount = await db.query.account.findFirst({
        where: and(eq(account.userId, platformUser.id), eq(account.providerId, "credential")),
      });

      if (existingAccount) {
        await db
          .update(account)
          .set({ password: hashedPassword, updatedAt: new Date() })
          .where(eq(account.id, existingAccount.id));
      } else {
        await db.insert(account).values({
          id: `acc_admin_${Date.now()}`,
          accountId: platformUser.id,
          providerId: "credential",
          userId: platformUser.id,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      console.log(
        `[Auth] Password akun platform (${adminEmail}) berhasil disinkronkan dari environment.`
      );
    }
  } catch (error: any) {
    console.warn("[Auth] Gagal memeriksa status admin platform:", error?.message || error);
  }
}

export const ensureFirstUserIsAdmin = ensurePlatformAdmin;

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

  // Graceful Shutdown (Item 12)
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
