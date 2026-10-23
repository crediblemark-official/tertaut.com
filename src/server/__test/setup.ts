import { beforeAll, beforeEach } from "bun:test";
import { resetRateLimits } from "../services/security/rateLimiter";
import { auth } from "../auth";
import { config } from "../config";
import {
  DEFAULT_GATEWAY_ID,
  GATEWAY_IDS,
  normalizeGatewayId,
  type GatewayId,
} from "../services/payments/gateways/registry";

export let authCookie = "";

/**
 * Pastikan user admin test punya profil builder.
 *
 * Endpoint dashboard seperti `GET /payouts/account` mencari profil builder lewat
 * `userId`/`email` dari user yang login. Di database fresh tidak ada baris untuk
 * `admin@tertaut.com`, sehingga test tersebut 404 — dan hanya lolos di full run
 * karena file test lain kebetulan membuat profil lebih dulu. Fixture-nya dibuat
 * eksplisit di sini supaya tiap file bisa dijalankan mandiri.
 */
async function ensureAdminBuilderProfile(): Promise<void> {
  try {
    const email = "admin@tertaut.com";
    const { db } = await import("../db");
    const { builders } = await import("../db/schema/builders");
    const { user } = await import("../db/schema/auth");
    const { eq } = await import("drizzle-orm");
    const { generateAppApiKey, generateBuilderSecretApiKey } =
      await import("../routes/apps/api-key");

    const [existing] = await db
      .select({ id: builders.id })
      .from(builders)
      .where(eq(builders.email, email));
    if (existing) return;

    const [authUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (!authUser) return;

    await db.insert(builders).values({
      userId: authUser.id,
      email,
      name: "Admin Test Builder",
      apiKey: generateAppApiKey("live"),
      secretApiKey: generateBuilderSecretApiKey(),
    });
  } catch (err: any) {
    console.warn("[Test] Gagal membuat profil builder admin:", err?.message);
  }
}

export async function ensureAdminAuth(): Promise<string> {
  if (authCookie) return authCookie;
  try {
    const { user } = await import("../db/schema/auth");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    await db
      .update(user)
      .set({ role: "admin", emailVerified: true })
      .where(eq(user.email, "admin@tertaut.com"));

    let res = await auth.api.signInEmail({
      body: { email: "admin@tertaut.com", password: "AdminPassword123!" },
      asResponse: true,
    });
    if (!res.ok) {
      await auth.api.signUpEmail({
        body: { email: "admin@tertaut.com", password: "AdminPassword123!", name: "Admin Test" },
        asResponse: true,
      });
      await db
        .update(user)
        .set({ role: "admin", emailVerified: true })
        .where(eq(user.email, "admin@tertaut.com"));
      res = await auth.api.signInEmail({
        body: { email: "admin@tertaut.com", password: "AdminPassword123!" },
        asResponse: true,
      });
    }
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      authCookie = setCookie.split(";")[0];
    }
    await ensureAdminBuilderProfile();
  } catch (err: any) {
    console.warn("[Test] Failed to sign in admin:", err?.message);
  }
  return authCookie;
}

import { app } from "../index";

/** Default pengujian mengikuti gateway produksi. */
const FALLBACK_TEST_GATEWAY: GatewayId = "xendit";

function resolveTestGateway(): GatewayId {
  // Hanya `TERTAUT_TEST_GATEWAY` yang dihormati (bukan ACTIVE_PAYMENT_GATEWAY /
  // PAYMENT_GATEWAY) supaya file `.env` lokal tidak bisa diam-diam mengubah
  // gateway yang diuji. Nama-nama gateway pun berasal dari registry, jadi
  // menambah/menghapus gateway tidak perlu menyentuh file test ini.
  const raw = (process.env.TERTAUT_TEST_GATEWAY || "").toLowerCase().trim();
  const normalized = normalizeGatewayId(raw);
  if (normalized) return normalized;
  if (raw) {
    console.warn(
      `[Test] TERTAUT_TEST_GATEWAY="${raw}" tidak dikenal. Pilihan: ${GATEWAY_IDS.join(", ")}. ` +
        `Memakai "${FALLBACK_TEST_GATEWAY}".`
    );
  }
  return FALLBACK_TEST_GATEWAY;
}

async function normalizeTestGateway(): Promise<void> {
  const gateway = resolveTestGateway();
  try {
    const { db } = await import("../db");
    const { platformSettings } = await import("../db/schema/settings");
    const { eq } = await import("drizzle-orm");
    await db
      .update(platformSettings)
      .set({ value: gateway })
      .where(eq(platformSettings.key, "active_payment_gateway"));
  } catch (err: any) {
    console.warn("[Test] Gagal menormalkan active_payment_gateway:", err?.message);
  }
}

// Top-level await: jalan tepat sekali saat setup.ts pertama kali diimpor,
// yaitu sebelum test apa pun pada file mana pun dijalankan.
await ensureAdminAuth();
await ensureAdminBuilderProfile();
await normalizeTestGateway();

export function setupTestAuth() {
  beforeAll(async () => {
    await ensureAdminAuth();
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (url.includes("http://localhost:8081") || url.includes("http://localhost:3001")) {
      init = init || {};
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : {}));
      if (authCookie && !headers.has("cookie")) {
        headers.set("cookie", authCookie);
      }
      init.headers = headers;
      const normalizedUrl = url.replace("http://localhost:3001", "http://localhost:8081");
      const req =
        typeof input === "string"
          ? new Request(normalizedUrl, init)
          : new Request(
              new Request(
                input.url.replace("http://localhost:3001", "http://localhost:8081"),
                input
              ),
              init
            );
      return app.handle(req);
    }
    return originalFetch(input, init);
  }) as typeof globalThis.fetch;

  beforeEach(() => resetRateLimits());
}
