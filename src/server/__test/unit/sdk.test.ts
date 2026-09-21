import { describe, it, expect } from "bun:test";
import { Tertaut } from "../../../../packages/sdk/src/index";

describe("Unit Tests - Tertaut SDK", () => {
  it("should enforce constructor validations and derive environment from apiKey", () => {
    expect(() => new Tertaut({} as any)).toThrow("[Tertaut SDK] apiKey wajib diisi");
    expect(() => new Tertaut({ apiKey: "junk", appId: "app_x", baseUrl: "http://x.test" } as any)).toThrow(
      "[Tertaut SDK] apiKey wajib diisi"
    );
    expect(() => new Tertaut({ apiKey: "tt_test_abc", appId: "app_x" } as any)).toThrow(
      "baseUrl wajib diisi"
    );
    expect(() => new Tertaut({ apiKey: "tt_live_abc", baseUrl: "https://x.com", appId: "" } as any)).toThrow(
      "[Tertaut SDK] appId is required."
    );

    const sdkSandbox = new Tertaut({ apiKey: "tt_test_sandbox", appId: "app_test_sandbox", baseUrl: "http://localhost:3001" });
    expect(sdkSandbox.baseUrl).toBe("http://localhost:3001");
    expect(sdkSandbox.environment).toBe("sandbox");

    const sdkProd = new Tertaut({ apiKey: "tt_live_prod", appId: "app_test_prod", baseUrl: "https://tertaut.com" });
    expect(sdkProd.baseUrl).toBe("https://tertaut.com");
    expect(sdkProd.environment).toBe("production");

    const sdkCustom = new Tertaut({ apiKey: "tt_test_custom", appId: "app_test_custom", baseUrl: "https://custom.api.com/" });
    expect(sdkCustom.baseUrl).toBe("https://custom.api.com");

    const TertautDefault = require("../../../../packages/sdk/src/index").default;
    expect(TertautDefault).toBe(Tertaut);
  });

  it("should validate checkout params and execute checkout session request", async () => {
    const sdk = new Tertaut({ apiKey: "tt_test_sdk", appId: "app_sdk_test", baseUrl: "http://localhost:3001" });

    // Missing customerEmail throws
    expect(sdk.checkout({ amount: 100_000 } as any)).rejects.toThrow("customerEmail is required");

    // Mock fetch for checkout
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://localhost:3001/api/v1/checkout/session");
      const body = JSON.parse(init?.body as string);
      expect(body.appId).toBe("app_sdk_test");
      expect(body.amount).toBe(75_000);
      expect(body.grantDays).toBe(30);
      return new Response(
        JSON.stringify({
          checkoutUrl: "https://tertaut.com/pay/tx_123",
          transactionId: "tx_123",
        }),
        { status: 200 }
      );
    }) as any;

    const result = await sdk.checkout({
      amount: 75_000,
      customerEmail: "sdkbuyer@tertaut.com",
    });

    expect(result.checkoutUrl).toBe("https://tertaut.com/pay/tx_123");
    expect(result.transactionId).toBe("tx_123");

    globalThis.fetch = originalFetch;
  });

  it("should invoke licensing methods: validate, verify, activate, deactivate, and getJwks", async () => {
    const sdk = new Tertaut({ apiKey: "tt_test_lic", appId: "app_lic_sdk", baseUrl: "http://localhost:3001" });
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (url: string) => {
      if (url.endsWith("/licensing/verify") || url.endsWith("/licensing/validate")) {
        return new Response(JSON.stringify({ valid: true, status: "ACTIVE", entitlements: { pro: true } }), { status: 200 });
      }
      if (url.endsWith("/licensing/activate")) {
        return new Response(JSON.stringify({ activated: true }), { status: 200 });
      }
      if (url.endsWith("/licensing/deactivate")) {
        return new Response(JSON.stringify({ deactivated: true }), { status: 200 });
      }
      if (url.endsWith("/jwks.json")) {
        return new Response(JSON.stringify({ keys: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as any;

    const val = await sdk.licensing.validate({ licenseKey: "TT-123", hardwareId: "HW-1" });
    expect(val.valid).toBe(true);

    const ent = await sdk.licensing.entitlements({ licenseKey: "TT-123", hwid: "HW-1" });
    expect(ent.valid).toBe(true);
    expect(ent.entitlements.pro).toBe(true);

    const ver = await sdk.licensing.verify({ licenseKey: "TT-123", hwid: "HW-1" });
    expect(ver.valid).toBe(true);

    const act = await sdk.licensing.activate({ licenseKey: "TT-123", hwid: "HW-1" });
    expect(act.activated).toBe(true);

    const deact = await sdk.licensing.deactivate({ licenseKey: "TT-123", hwid: "HW-1" });
    expect(deact.deactivated).toBe(true);

    const jwks = await sdk.licensing.getJwks();
    expect(jwks.keys).toBeDefined();

    globalThis.fetch = originalFetch;
  });

  it("should verify offline token errors: malformed, missing keys, invalid signature", async () => {
    const sdk = new Tertaut({ apiKey: "tt_live_offline", appId: "app_offline_sdk", baseUrl: "https://tertaut.com" });

    // Malformed token
    const malformed = await sdk.licensing.verifyOfflineToken("not.enough.parts.four.five");
    expect(malformed.valid).toBe(false);

    const empty = await sdk.licensing.verifyOfflineToken("");
    expect(empty.valid).toBe(false);
    expect(empty.reason).toBe("MALFORMED_TOKEN");

    // Missing JWK keys (default url and custom jwksUrl)
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ keys: [] }), { status: 200 });
    }) as any;

    const noKey = await sdk.licensing.verifyOfflineToken("header.claims.sig");
    expect(noKey.valid).toBe(false);
    expect(noKey.reason).toBe("PUBLIC_KEY_UNAVAILABLE");

    const noKeyCustomUrl = await sdk.licensing.verifyOfflineToken("header.claims.sig", {
      jwksUrl: "https://custom.jwks.url/jwks.json",
    });
    expect(noKeyCustomUrl.valid).toBe(false);
    expect(noKeyCustomUrl.reason).toBe("PUBLIC_KEY_UNAVAILABLE");

    const { verifyEd25519OfflineToken } = require("../../../../packages/sdk/src/utils/crypto");
    const noBaseResult = await verifyEd25519OfflineToken("header.claims.sig");
    expect(noBaseResult.valid).toBe(false);
    expect(noBaseResult.reason).toBe("PUBLIC_KEY_UNAVAILABLE");

    globalThis.fetch = originalFetch;
  });

  it("should wrap credits API: balance, consume, and history", async () => {
    const sdk = new Tertaut({ apiKey: "tt_test_credits", appId: "app_credits_sdk", baseUrl: "http://localhost:3001" });
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (url: string) => {
      if (url.endsWith("/credits/balance")) {
        return new Response(JSON.stringify({ balance: 100 }), { status: 200 });
      }
      if (url.endsWith("/credits/consume")) {
        return new Response(JSON.stringify({ balance: 80, consumed: 20 }), { status: 200 });
      }
      if (url.endsWith("/credits/history")) {
        return new Response(JSON.stringify({ balance: 80, entries: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as any;

    const bal = await sdk.credits.balance({ licenseKey: "TT-CRED", hwid: "HW-1" });
    expect(bal.balance).toBe(100);

    const con = await sdk.credits.consume({ licenseKey: "TT-CRED", hwid: "HW-1", amount: 20 });
    expect(con.consumed).toBe(20);

    const hist = await sdk.credits.history({ licenseKey: "TT-CRED", hwid: "HW-1" });
    expect(hist.balance).toBe(80);

    globalThis.fetch = originalFetch;
  });

  it("should support aiProxy chat and chatStream SSE streaming parser", async () => {
    const sdk = new Tertaut({ apiKey: "tt_live_ai", appId: "app_ai_sdk", baseUrl: "http://localhost:3001" });
    const originalFetch = globalThis.fetch;

    // 1. Non-streaming chat
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ text: "AI Response", model: "fast-summary" }), {
        status: 200,
      });
    }) as any;

    const chatRes = await sdk.aiProxy.chat({
      licenseKey: "TT-AI-KEY",
      prompt: "Ringkas dokumen ini",
    });
    expect(chatRes.text).toBe("AI Response");

    // 2. Streaming chatStream (SSE Generator)
    const sseBody = [
      'data: {"choices":[{"delta":{"content":"Halo "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Dunia!"}}]}\n\n',
      "data: [DONE]\n\n",
    ].join("");

    globalThis.fetch = (async () => {
      return new Response(sseBody, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }) as any;

    const stream = await sdk.aiProxy.chatStream({
      licenseKey: "TT-AI-KEY",
      prompt: "Streaming test",
    });

    const iterator = stream[Symbol.asyncIterator]();
    expect(iterator).toBeDefined();

    const collected: string[] = [];
    for await (const chunk of stream) {
      collected.push(chunk.text);
    }

    expect(collected.join("")).toBe("Halo Dunia!");

    // 3. Error response handling in chatStream
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ message: "Daily limit exceeded" }), { status: 429 });
    }) as any;

    expect(
      sdk.aiProxy.chatStream({
        licenseKey: "TT-AI-KEY",
        prompt: "Will fail",
      })
    ).rejects.toThrow("Daily limit exceeded");

    // 4. Missing response body in chatStream
    globalThis.fetch = (async () => {
      const res = new Response();
      Object.defineProperty(res, "body", { value: null });
      return res;
    }) as any;

    expect(
      sdk.aiProxy.chatStream({
        licenseKey: "TT-AI-KEY",
        prompt: "No body",
      })
    ).rejects.toThrow("No response body available");

    globalThis.fetch = originalFetch;
  });

  it("should manage automatic heartbeat sessions for floating licenses", async () => {
    const sdk = new Tertaut({ apiKey: "tt_test_session", appId: "app_session", baseUrl: "http://localhost:3001" });
    const originalFetch = globalThis.fetch;

    let heartbeatCount = 0;
    globalThis.fetch = (async () => {
      heartbeatCount++;
      return new Response(JSON.stringify({ success: true, expiresAt: "2026-10-01T00:00:00Z" }), { status: 200 });
    }) as any;

    const session = sdk.licensing.startHeartbeatSession({
      licenseKey: "TT-SESSION",
      hwid: "HW-SESSION",
      leaseKey: "lease_initial_123",
      intervalSeconds: 100, // jangan sampai auto-fire saat test
    });

    expect(session.isActive()).toBe(true);
    expect(session.getLeaseKey()).toBe("lease_initial_123");

    const beatRes = await session.beatNow();
    expect(beatRes.success).toBe(true);
    expect(heartbeatCount).toBe(1);

    session.stop();
    expect(session.isActive()).toBe(false);

    globalThis.fetch = originalFetch;
  });

  it("should perform smart license check with offline fallback and feature helpers", async () => {
    const sdk = new Tertaut({ apiKey: "tt_test_smart", appId: "app_smart", baseUrl: "http://localhost:3001" });
    const originalFetch = globalThis.fetch;

    // 1. Online check
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          valid: true,
          status: "ACTIVE",
          entitlements: { "ai-pro": true, max_files: 50 },
          licenseVersion: 2,
        }),
        { status: 200 }
      );
    }) as any;

    const onlineCheck = await sdk.licensing.check({
      licenseKey: "TT-ONLINE",
      hwid: "HW-1",
    });

    expect(onlineCheck.valid).toBe(true);
    expect(onlineCheck.source).toBe("online");
    expect(onlineCheck.hasFeature("ai-pro")).toBe(true);
    expect(onlineCheck.hasFeature("non_existent")).toBe(false);
    expect(onlineCheck.getFeature("max_files", 10)).toBe(50);
    expect(onlineCheck.getFeature("non_existent", "default")).toBe("default");

    // 2. Offline fallback check when network error occurs
    globalThis.fetch = (async () => {
      throw new Error("Network offline");
    }) as any;

    // Smart check without offlineToken returns invalid gracefully
    const noToken = await sdk.licensing.check({
      licenseKey: "TT-OFFLINE",
      allowOfflineFallback: true,
    });
    expect(noToken.valid).toBe(false);
    expect(noToken.reason).toBe("SERVER_UNREACHABLE_NO_OFFLINE_TOKEN");

    globalThis.fetch = originalFetch;
  });

  it("should verify webhook signatures with Tertaut.verifyWebhookSignature", async () => {
    const secret = "whsec_test_secret_123";
    const body = JSON.stringify({ event: "license.issued", data: { licenseKey: "TT-123" } });

    // Hitung signature HMAC-SHA256 yang sah
    const { createHmac } = await import("crypto");
    const validSig = `hmac-sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

    const isValid = await Tertaut.verifyWebhookSignature(body, validSig, secret);
    expect(isValid).toBe(true);

    const isInvalid = await Tertaut.verifyWebhookSignature(body, "hmac-sha256=invalid_hash", secret);
    expect(isInvalid).toBe(false);

    const isMismatchedSecret = await Tertaut.verifyWebhookSignature(body, validSig, "wrong_secret");
    expect(isMismatchedSecret).toBe(false);

    // Trigger catch block in verifyWebhookSignature
    const { verifyWebhookSignature: directVerify } = require("../../../../packages/sdk/src/utils/crypto");
    const throwsHandled1 = await directVerify(body, validSig, null as any);
    expect(throwsHandled1).toBe(false);

    const throwsHandled2 = await directVerify(body, null as any, secret);
    expect(throwsHandled2).toBe(false);
  });

  it("should support Server-to-Server (S2S) operations when initialized with tt_secret_ key", async () => {
    const s2sClient = new Tertaut({
      apiKey: "tt_secret_my_super_secret_key",
      baseUrl: "http://localhost:3001",
    });
    expect(s2sClient.apiKey).toBe("tt_secret_my_super_secret_key");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      expect(init?.headers).toBeDefined();
      const auth = (init?.headers as any)?.Authorization;
      expect(auth).toBe("Bearer tt_secret_my_super_secret_key");

      if (url.endsWith("/api/v1/s2s")) {
        return new Response(JSON.stringify({ service: "tertaut.com S2S API", builder: { id: "bld_1" } }), { status: 200 });
      }
      if (url.includes("/api/v1/s2s/apps")) {
        return new Response(JSON.stringify([{ id: "app_1", name: "Pro App" }]), { status: 200 });
      }
      if (url.endsWith("/api/v1/s2s/licenses/issue")) {
        return new Response(JSON.stringify({ success: true, license: { licenseKey: "TT-S2S-NEW" } }), { status: 200 });
      }
      if (url.endsWith("/api/v1/s2s/webhooks")) {
        return new Response(JSON.stringify({ success: true, webhooks: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as any;

    const info = await s2sClient.s2s.info();
    expect(info.service).toContain("S2S API");

    const issued = await s2sClient.s2s.licenses.issue({
      appId: "app_1",
      customerEmail: "s2s_buyer@test.com",
    });
    expect(issued.license.licenseKey).toBe("TT-S2S-NEW");

    const whs = await s2sClient.s2s.webhooks.list();
    expect(whs.success).toBe(true);

    globalThis.fetch = originalFetch;
  });

  it("should cover all Custom Error classes and inheritance", () => {
    const {
      TertautError,
      LicenseExpiredError,
      LicenseRevokedError,
      SeatLimitExceededError,
      HeartbeatLeaseError,
      InsufficientCreditsError,
      VersionFloorError,
    } = require("../../../../packages/sdk/src/errors");

    const base = new TertautError("General error", { code: "ERR_BASE", status: 500, details: { foo: "bar" } });
    expect(base.name).toBe("TertautError");
    expect(base.message).toBe("General error");
    expect(base.code).toBe("ERR_BASE");
    expect(base.status).toBe(500);
    expect(base.details.foo).toBe("bar");

    const exp = new LicenseExpiredError();
    expect(exp.name).toBe("LicenseExpiredError");
    expect(exp.code).toBe("TOKEN_EXPIRED");
    expect(exp.status).toBe(403);

    const rev = new LicenseRevokedError("Revoked custom", { lic: "TT-1" });
    expect(rev.name).toBe("LicenseRevokedError");
    expect(rev.code).toBe("TOKEN_REVOKED");
    expect(rev.details.lic).toBe("TT-1");

    const seat = new SeatLimitExceededError();
    expect(seat.name).toBe("SeatLimitExceededError");
    expect(seat.code).toBe("SEAT_FULL");

    const leaseExp = new HeartbeatLeaseError();
    expect(leaseExp.name).toBe("HeartbeatLeaseError");
    expect(leaseExp.code).toBe("LEASE_EXPIRED");
    expect(leaseExp.status).toBe(409);

    const leaseInv = new HeartbeatLeaseError("Invalid lease", "LEASE_INVALID");
    expect(leaseInv.status).toBe(403);

    const cred = new InsufficientCreditsError();
    expect(cred.name).toBe("InsufficientCreditsError");
    expect(cred.code).toBe("INSUFFICIENT_CREDITS");

    const vfl = new VersionFloorError("Too old", "2.0.0");
    expect(vfl.name).toBe("VersionFloorError");
    expect(vfl.details.minVersion).toBe("2.0.0");
  });

  it("should cover Semver parser and version comparison utilities", () => {
    const { parseSemver, isVersionOlder } = require("../../../../packages/sdk/src/utils/semver");

    expect(parseSemver("v1.2.3")).toEqual([1, 2, 3]);
    expect(parseSemver("2.0")).toEqual([2, 0]);
    expect(parseSemver("invalid")).toEqual([0]);

    // isVersionOlder(current, min)
    expect(isVersionOlder("1.0.0", "1.0.1")).toBe(true);
    expect(isVersionOlder("1.0.0", "1.1.0")).toBe(true);
    expect(isVersionOlder("1.0.0", "2.0.0")).toBe(true);
    expect(isVersionOlder("2.0.0", "1.9.9")).toBe(false);
    expect(isVersionOlder("1.2.3", "1.2.3")).toBe(false);
    expect(isVersionOlder("1.2", "1.2.1")).toBe(true);
    expect(isVersionOlder("1.2.1", "1.2")).toBe(false);
  });

  it("should test checkout error cases and browser redirect simulation", async () => {
    const { executeCheckout } = require("../../../../packages/sdk/src/modules/checkout");

    // 1. Missing customerEmail
    await expect(
      executeCheckout({ request: async () => new Response("{}"), appId: "app_1" }, { amount: 100 } as any)
    ).rejects.toThrow("customerEmail is required");

    // 2. Missing appId
    await expect(
      executeCheckout({ request: async () => new Response("{}"), appId: "" }, { amount: 100, customerEmail: "test@x.com" })
    ).rejects.toThrow("appId is required");

    // 3. Failed HTTP response
    await expect(
      executeCheckout(
        {
          request: async () => new Response("Bad Request", { status: 400, statusText: "Bad Request" }),
          appId: "app_1",
        },
        { amount: 100, customerEmail: "test@x.com" }
      )
    ).rejects.toThrow("Checkout session failed: Bad Request");

    // 4. Browser window redirect simulation
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = { location: { href: "" } };

    const res = await executeCheckout(
      {
        request: async () =>
          new Response(JSON.stringify({ checkoutUrl: "https://pay.example.com", transactionId: "tx_1" })),
        appId: "app_1",
      },
      { amount: 100, customerEmail: "test@x.com" }
    );
    expect(res.checkoutUrl).toBe("https://pay.example.com");
    expect((globalThis as any).window.location.href).toBe("https://pay.example.com");

    (globalThis as any).window = originalWindow;
  });

  it("should test licensing heartbeat failure callbacks, check offline branch, and utility methods", async () => {
    const { createFeatureHelpers } = require("../../../../packages/sdk/src/modules/licensing");
    const defaultHelpers = createFeatureHelpers();
    expect(defaultHelpers.hasFeature("any")).toBe(false);

    const sdk = new Tertaut({ apiKey: "tt_test_lic_cov", appId: "app_cov", baseUrl: "http://localhost:3001" });

    // 1. hasFeature and getFeature helper methods on licensing module
    expect(sdk.licensing.hasFeature({ "pro-plan": true }, "pro-plan")).toBe(true);
    expect(sdk.licensing.hasFeature({}, "pro-plan")).toBe(false);
    expect(sdk.licensing.getFeature({ limit: 100 }, "limit", 10)).toBe(100);
    expect(sdk.licensing.getFeature({}, "limit", 10)).toBe(10);

    // 2. startHeartbeatSession - lease expired callback
    let leaseExpiredCalled = false;
    let errorCalled = false;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Seat lease expired",
          errorCode: "LEASE_EXPIRED",
        }),
        { status: 200 }
      );
    }) as any;

    const session = sdk.licensing.startHeartbeatSession({
      licenseKey: "TT-EXP",
      hwid: "HW-EXP",
      leaseKey: "lease_exp_1",
      intervalSeconds: 999,
      onLeaseExpired: () => {
        leaseExpiredCalled = true;
      },
      onError: () => {
        errorCalled = true;
      },
    });

    const res = await session.beatNow();
    expect(res.success).toBe(false);
    expect(leaseExpiredCalled).toBe(true);
    expect(errorCalled).toBe(true);
    expect(session.isActive()).toBe(false);

    // beatNow on stopped session throws
    await expect(session.beatNow()).rejects.toThrow("Heartbeat session has stopped");

    // 3. startHeartbeatSession - network exception in beatNow
    globalThis.fetch = (async () => {
      throw new Error("Connection reset");
    }) as any;

    const session2 = sdk.licensing.startHeartbeatSession({
      licenseKey: "TT-ERR",
      hwid: "HW-ERR",
      leaseKey: "lease_err_1",
      intervalSeconds: 999,
      onError: (err) => {
        expect(err.message).toBe("Connection reset");
      },
    });

    await expect(session2.beatNow()).rejects.toThrow("Connection reset");
    session2.stop();

    // Test heartbeat timer tick
    let tickFired = false;
    globalThis.fetch = (async () => {
      tickFired = true;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as any;

    const sessionTick = sdk.licensing.startHeartbeatSession({
      licenseKey: "TT-TICK",
      hwid: "HW-TICK",
      leaseKey: "lease_tick_1",
      intervalSeconds: 0.01,
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(tickFired).toBe(true);
    sessionTick.stop();

    // 4. check method - allowOfflineFallback: false throws online error
    globalThis.fetch = (async () => {
      throw new Error("Server down");
    }) as any;

    await expect(
      sdk.licensing.check({
        licenseKey: "TT-FAIL",
        allowOfflineFallback: false,
      })
    ).rejects.toThrow("Server down");

    globalThis.fetch = originalFetch;
  });

  it("should test all S2S module methods and endpoints", async () => {
    const s2sClient = new Tertaut({
      apiKey: "tt_secret_complete_s2s_key",
      baseUrl: "http://localhost:3001",
      appId: "app_default",
    });

    const calls: { url: string; method?: string; body?: any }[] = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        method: init?.method || "GET",
        body: init?.body ? JSON.parse(init.body as string) : undefined,
      });
      return new Response(JSON.stringify({ success: true, url }), { status: 200 });
    }) as any;

    // apps.list & apps.get
    await s2sClient.s2s.apps.list();
    await s2sClient.s2s.apps.list("sandbox");
    await s2sClient.s2s.apps.get("app_target_1");

    // licenses.list with filters
    await s2sClient.s2s.licenses.list({ appId: "app_1", status: "ACTIVE", limit: 50 });

    // licenses.issueBatch
    await s2sClient.s2s.licenses.issueBatch({
      items: [{ customerEmail: "a@test.com" }, { customerEmail: "b@test.com" }],
    });

    // licenses.revoke & revokeBatch
    await s2sClient.s2s.licenses.revoke({ licenseKey: "TT-REV-1" });
    await s2sClient.s2s.licenses.revokeBatch({ licenseKeys: ["TT-REV-1", "TT-REV-2"] });

    // licenses.seats & releaseSeat
    await s2sClient.s2s.licenses.seats("TT-SEATS");
    await s2sClient.s2s.licenses.releaseSeat({ licenseKey: "TT-SEATS", hwid: "HW-1" });

    // licenses.recover & transfer
    await s2sClient.s2s.licenses.recover("TT-REC");
    await s2sClient.s2s.licenses.transfer({ licenseKey: "TT-TRF", newCustomerEmail: "new@test.com" });

    // licenses.events
    await s2sClient.s2s.licenses.events({
      licenseKey: "TT-EV",
      appId: "app_1",
      event: "license.issued",
      actorType: "api",
      limit: 20,
    });

    // credits.balance & credits.consume
    await s2sClient.s2s.credits.balance("TT-CRED-S2S");
    await s2sClient.s2s.credits.consume({ licenseKey: "TT-CRED-S2S", amount: 50, reason: "Bulk generation" });

    // webhooks: create, update, delete, rotateSecret, test, verifySignature
    await s2sClient.s2s.webhooks.create({ url: "https://myhook.com" });
    await s2sClient.s2s.webhooks.update("wh_1", { isActive: false });
    await s2sClient.s2s.webhooks.delete("wh_1");
    await s2sClient.s2s.webhooks.rotateSecret("wh_1");
    await s2sClient.s2s.webhooks.test("wh_1");

    const sigOk = await s2sClient.s2s.webhooks.verifySignature("{}", "invalid_sig", "sec");
    expect(sigOk).toBe(false);

    expect(calls.length).toBeGreaterThan(15);
    globalThis.fetch = originalFetch;
  });

  it("should test Web Crypto Ed25519 offline token verification with valid key and claims", async () => {
    const { verifyEd25519OfflineToken } = require("../../../../packages/sdk/src/utils/crypto");

    // 1. Buat keypair Ed25519 dan JWK publik
    const keyPair = await crypto.subtle.generateKey(
      { name: "Ed25519" } as any,
      true,
      ["sign", "verify"]
    );
    const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

    // 2. Buat token JWT Ed25519 valid
    const header = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWT" })).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const validClaims = {
      typ: "license",
      lic: "TT-VALID-123",
      app: "app_test",
      seats: 2,
      feat: { "ai-pro": true, quota: 100 },
      vfl: "1.0.0",
      exp: now + 3600,
    };
    const body = Buffer.from(JSON.stringify(validClaims)).toString("base64url");

    const dataToSign = new TextEncoder().encode(`${header}.${body}`);
    const signatureBuffer = await crypto.subtle.sign("Ed25519" as any, keyPair.privateKey, dataToSign);
    const signature = Buffer.from(signatureBuffer).toString("base64url");
    const validToken = `${header}.${body}.${signature}`;

    // 3. Verifikasi dengan publicKeyJwk yang valid
    const res = await verifyEd25519OfflineToken(validToken, {
      publicKeyJwk,
      appVersion: "1.5.0",
    });
    expect(res.valid).toBe(true);
    expect(res.claims.lic).toBe("TT-VALID-123");
    expect(res.claims.feat["ai-pro"]).toBe(true);

    // 4. Verifikasi kegagalan jika appVersion terlalu tua (vfl: 1.0.0 vs appVersion: 0.9.0)
    const resOld = await verifyEd25519OfflineToken(validToken, {
      publicKeyJwk,
      appVersion: "0.9.0",
    });
    expect(resOld.valid).toBe(false);
    expect(resOld.reason).toBe("APP_VERSION_TOO_OLD");

    // 5. Verifikasi kegagalan jika typ bukan 'license'
    const invalidTypeClaims = { ...validClaims, typ: "session" };
    const invalidTypeBody = Buffer.from(JSON.stringify(invalidTypeClaims)).toString("base64url");
    const invalidTypeSig = Buffer.from(
      await crypto.subtle.sign(
        "Ed25519" as any,
        keyPair.privateKey,
        new TextEncoder().encode(`${header}.${invalidTypeBody}`)
      )
    ).toString("base64url");

    const resType = await verifyEd25519OfflineToken(`${header}.${invalidTypeBody}.${invalidTypeSig}`, {
      publicKeyJwk,
    });
    expect(resType.valid).toBe(false);
    expect(resType.reason).toBe("INVALID_TOKEN_TYPE");

    // 6. Verifikasi kegagalan jika token expired
    const expiredClaims = { ...validClaims, exp: now - 3600 };
    const expiredBody = Buffer.from(JSON.stringify(expiredClaims)).toString("base64url");
    const expiredSig = Buffer.from(
      await crypto.subtle.sign(
        "Ed25519" as any,
        keyPair.privateKey,
        new TextEncoder().encode(`${header}.${expiredBody}`)
      )
    ).toString("base64url");

    const resExp = await verifyEd25519OfflineToken(`${header}.${expiredBody}.${expiredSig}`, {
      publicKeyJwk,
    });
    expect(resExp.valid).toBe(false);
    expect(resExp.reason).toBe("TOKEN_EXPIRED");

    // 7. Verifikasi kegagalan signature mismatch
    const tamperedToken = `${header}.${body}.tampered_signature_bytes`;
    const resTampered = await verifyEd25519OfflineToken(tamperedToken, { publicKeyJwk });
    expect(resTampered.valid).toBe(false);

    // 8. Trigger catch block with invalid token that throws during JSON.parse or decode
    const throwToken = `${header}.invalid_non_json_body.${signature}`;
    const resThrow = await verifyEd25519OfflineToken(throwToken, { publicKeyJwk });
    expect(resThrow.valid).toBe(false);
    expect(resThrow.reason).toBeDefined();
  });
});

