import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";
import { apiV1Routes } from "./routes/api";
import { badgeRoutes } from "./routes/badge";
import { webhookRoutes, webhooksPluralRoutes, snapBiWebhookRoutes } from "./routes/webhook";
import { checkoutRoutes } from "./routes/checkout";
import { config } from "./config";
import { auth } from "./auth";
import { LicenseTokenService } from "./services/licenseToken";
import { existsSync, statSync } from "fs";
import { resolve } from "path";
import { db } from "./db";
import { licenses } from "./db/schema";
import { eq, and, lt } from "drizzle-orm";

const clientDistPath = resolve(import.meta.dir, "../../dist");
const isProduction = process.env.NODE_ENV === "production";
const hasBuiltClient = isProduction && existsSync(clientDistPath);

export const app = new Elysia()
  // Secure CORS: Only allow trusted origins with credentials
  .use(
    cors({
      origin: (request: Request) => {
        const origin = request.headers.get("origin");
        // Allow requests with no origin, or opaque origin 'null' (sandboxed iframes, local previews)
        if (!origin || origin === "null") return true;

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
        } catch {}

        const allowedPatterns = [
          /^https?:\/\/localhost(:\d+)?$/,
          /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
          /\.tertaut\.com$/,
        ];
        if (config.publicAppUrl) {
          try {
            if (origin === new URL(config.publicAppUrl).origin) return true;
          } catch {}
        }
        if (config.publicStoreUrl) {
          try {
            if (origin === new URL(config.publicStoreUrl).origin) return true;
          } catch {}
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
      documentation: {
        info: {
          title: "tertaut.com Engine API",
          version: "2.2.0",
          description:
            "Headless Developer Infrastructure Engine (Monetization, Universal Licensing, AI Protection, Fake Door Validation)",
        },
        tags: [
          { name: "System", description: "Health and diagnostics" },
          { name: "Apps", description: "Builder applications and stats" },
          { name: "Launch Kit", description: "One-click live launch, badges and developer SDK tooling" },
          { name: "MoR Checkout", description: "Xendit dynamic hosted checkout" },
          { name: "Universal Licensing", description: "Multi-platform key validation & hardware binding" },
          { name: "AI Proxy Shield", description: "Zero-leak AI API gateway" },
          { name: "Webhook", description: "Payment and disbursement callbacks" },
        ],
      },
    })
  )

  // Better Auth handler (sign-in/up, session) di /api/auth/*
  .all("/api/auth/*", ({ request }) => auth.handler(request))
  .get("/api/auth/*", ({ request }) => auth.handler(request))

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
  app.get("*", ({ request, set }) => {
    const url = new URL(request.url);
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
  // Development: Port 3000 is strictly Backend API & Swagger
  app.get("*", ({ request, set }) => {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return {
        service: "tertaut.com Engine Backend API",
        port: 3000,
        mode: "development",
        endpoints: {
          swagger: "http://localhost:3000/swagger",
          health: "http://localhost:3000/api/v1/health",
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
      .returning({ id: licenses.id, licenseKey: licenses.licenseKey });
    if (expired.length > 0) {
      console.log(`[Expiry] ${expired.length} license(s) marked EXPIRED.`);
    }
  } catch (err: any) {
    console.error("[Expiry] failed:", err?.message || err);
  }
}
expireLicenses();
setInterval(expireLicenses, 5 * 60 * 1000);

app.listen(config.port, () => {
  console.log(`\n🚀 tertaut.com Engine is running at http://localhost:${config.port}`);
  console.log(`📖 Interactive Swagger Docs: http://localhost:${config.port}/swagger`);
  console.log(`⚡ Runtime: Bun ${Bun.version} | Single Container Architecture ready\n`);
});

export type App = typeof app;
