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
import { LicenseTokenService } from "./services/licenseToken";
import { existsSync, statSync } from "fs";
import { resolve } from "path";
import { db } from "./db";
import { licenses, user } from "./db/schema";
import { eq, and, lt, asc } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { LicenseLeaseService } from "./services/licenseLease";
import { AuditService } from "./services/audit";
import { WebhookService } from "./services/webhooks";

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
        /^\/api\/v1\/checkout\/simulate-paid/,
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
  .use(checkoutRoutes);

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
    // SPA fallback
    .get("*", ({ request, set }) => {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        set.status = 404;
        return { error: `Endpoint API ${url.pathname} tidak ditemukan` };
      }
      const decodedPath = decodeURIComponent(url.pathname);
      // Sanitize path traversal attempts
      const safePath = decodedPath.replace(/\.\.+[/\\]/g, "");
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
        set.headers["content-type"] = "text/html; charset=utf8";
        return Bun.file(indexPath);
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

async function expireLicenses(): Promise<void> {
  try {
    const now = new Date();
    const expired = await db
      .update(licenses)
      .set({ status: "EXPIRED", updatedAt: now })
      .where(and(eq(licenses.status, "ACTIVE"), lt(licenses.expiresAt, now)))
      .returning({
        id: licenses.id,
        licenseKey: licenses.licenseKey,
        appId: licenses.appId,
        customerEmail: licenses.customerEmail,
        status: licenses.status,
      });
    if (expired.length > 0) {
      console.log(`[Expiry] ${expired.length} license(s) marked EXPIRED.`);
    }
    // Fase 4/3: audit trail + webhook license.expired (best-effort, di luar transaction).
    for (const lic of expired) {
      await AuditService.record(
        "license.expired",
        { licenseId: lic.id, licenseKey: lic.licenseKey, appId: lic.appId, actorType: "SYSTEM" },
        { expiresAt: now.toISOString() }
      );
      await WebhookService.emit("license.expired", {
        license: lic as any,
        actorType: "SYSTEM",
        payload: { expiresAt: now.toISOString() },
      });
    }
  } catch (err: any) {
    console.error("[Expiry] failed:", err?.message || err);
  }
}

/** Fase 2: lepas lease floating yang tidak pernah heartbeat sampai TTL habis. */
async function expireLeases(): Promise<void> {
  try {
    const released = await LicenseLeaseService.deleteExpired();
    if (released > 0) {
      console.log(`[Lease] ${released} floating lease(s) expired & released.`);
    }
  } catch (err: any) {
    console.error("[Lease] failed:", err?.message || err);
  }
}

/** Fase 3: deliverer outbox webhook (retry exponential backoff). */
async function dispatchWebhooks(): Promise<void> {
  try {
    const sent = await WebhookService.dispatchDue();
    if (sent > 0) {
      console.log(`[Webhook] ${sent} delivery(ies) diproses.`);
    }
  } catch (err: any) {
    console.error("[Webhook] dispatcher failed:", err?.message || err);
  }
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
    const adminEmail = (process.env.ADMIN_EMAIL || "platformtertaut@gmail.com").toLowerCase();
    const platformUser = await db.query.user.findFirst({
      where: eq(user.email, adminEmail),
    });
    if (platformUser && platformUser.role !== "admin") {
      await db
        .update(user)
        .set({ role: "admin", emailVerified: true })
        .where(eq(user.id, platformUser.id));
      console.log(`[Auth] Akun platform (${adminEmail}) dipastikan sebagai admin.`);
    }
  } catch (error: any) {
    console.warn("[Auth] Gagal memeriksa status admin platform:", error?.message || error);
  }
}

export const ensureFirstUserIsAdmin = ensurePlatformAdmin;

if (process.env.NODE_ENV !== "test") {
  await runAutoMigrations();
  await ensurePlatformAdmin();

  expireLicenses();
  setInterval(expireLicenses, 10 * 60 * 1000); // 10 menit (was 5 menit)
  expireLeases();
  setInterval(expireLeases, 2 * 60 * 1000); // 2 menit (was 1 menit)
  dispatchWebhooks();
  setInterval(dispatchWebhooks, 60 * 1000); // 1 menit (was 30 detik)

  app.listen(config.port, () => {
    console.log(`\n🚀 tertaut.com Engine is running at http://localhost:${config.port}`);
    console.log(`📖 Interactive Swagger Docs: http://localhost:${config.port}/swagger`);
    console.log(`⚡ Runtime: Bun ${Bun.version} | Single Container Architecture ready\n`);
  });
}

export type App = typeof app;
