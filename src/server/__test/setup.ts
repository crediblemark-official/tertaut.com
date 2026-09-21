import { beforeAll, beforeEach } from "bun:test";
import { resetRateLimits } from "../services/rateLimiter";
import { auth } from "../auth";

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
      // Normalize URL ke port yang dipakai server test
      const normalizedUrl = url.replace("http://localhost:3001", "http://localhost:8081");
      const req = input instanceof Request ? new Request(new Request(input, init), { ...init }) : new Request(normalizedUrl, init);
      return app.handle(req);
    }
    return originalFetch(input, init);
  }) as typeof globalThis.fetch;

  beforeEach(() => resetRateLimits());
}
