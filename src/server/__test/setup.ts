import { beforeAll, beforeEach } from "bun:test";
import { resetRateLimits } from "../services/rateLimiter";
import { auth } from "../auth";
import { createSign } from "crypto";
import { config } from "../config";

/**
 * Tanda tangani payload webhook DANA dengan private key yang dikonfigurasi
 * (format yang sama dengan fallback crypto RSA-SHA256 di verifyWebhook),
 * menghasilkan header `signature` yang VALID untuk dipakai di test yang
 * berjalan dengan public key terpasang (BUG-3 — signature kini wajib).
 */
export function signDanaWebhook(body: unknown): string {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const signer = createSign("SHA256");
  signer.update(raw);
  return signer.sign(config.dana.privateKey || "", "base64");
}

/** Kembalikan object headers webhook yang valid (signature RSA-SHA256) + header ekstra. */
export function danaWebhookHeaders(
  body: unknown,
  extra: Record<string, string> = {}
): Record<string, string> {
  return { signature: signDanaWebhook(body), ...extra };
}

export let authCookie = "";

export async function ensureAdminAuth(): Promise<string> {
  if (authCookie) return authCookie;
  try {
    const res = await auth.api.signInEmail({
      body: { email: "admin@tertaut.com", password: "AdminPassword123!" },
      asResponse: true,
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      authCookie = setCookie.split(";")[0];
    }
  } catch (err: any) {
    console.warn("[Test] Failed to sign in admin:", err?.message);
  }
  return authCookie;
}

import { app } from "../index";

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
