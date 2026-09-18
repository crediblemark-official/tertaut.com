import { describe, it, expect } from "bun:test";
import { Tertaut } from "../../../../packages/sdk/src/index";

describe("Unit Tests - Tertaut SDK", () => {
  it("should enforce constructor validations and default options", () => {
    expect(() => new Tertaut({} as any)).toThrow("[Tertaut SDK] appId is required.");

    const sdkSandbox = new Tertaut({ appId: "app_test_sandbox", environment: "sandbox" });
    expect(sdkSandbox.baseUrl).toBe("http://localhost:3000");

    const sdkProd = new Tertaut({ appId: "app_test_prod", environment: "production" });
    expect(sdkProd.baseUrl).toBe("https://tertaut.com");

    const sdkCustom = new Tertaut({ appId: "app_test_custom", baseUrl: "https://custom.api.com/" });
    expect(sdkCustom.baseUrl).toBe("https://custom.api.com");
  });

  it("should validate checkout params and execute checkout session request", async () => {
    const sdk = new Tertaut({ appId: "app_sdk_test", baseUrl: "http://localhost:3000" });

    // Missing customerEmail throws
    expect(sdk.checkout({ amount: 100_000 } as any)).rejects.toThrow("customerEmail is required");

    // Mock fetch for checkout
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://localhost:3000/api/v1/checkout/session");
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
    const sdk = new Tertaut({ appId: "app_lic_sdk", baseUrl: "http://localhost:3000" });
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (url: string) => {
      if (url.endsWith("/licensing/verify")) {
        return new Response(JSON.stringify({ valid: true, status: "ACTIVE" }), { status: 200 });
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
    const sdk = new Tertaut({ appId: "app_offline_sdk" });

    // Malformed token
    const malformed = await sdk.licensing.verifyOfflineToken("not.enough.parts.four.five");
    expect(malformed.valid).toBe(false);

    const empty = await sdk.licensing.verifyOfflineToken("");
    expect(empty.valid).toBe(false);
    expect(empty.reason).toBe("MALFORMED_TOKEN");

    // Missing JWK keys
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ keys: [] }), { status: 200 });
    }) as any;

    const noKey = await sdk.licensing.verifyOfflineToken("header.claims.sig");
    expect(noKey.valid).toBe(false);
    expect(noKey.reason).toBe("PUBLIC_KEY_UNAVAILABLE");

    globalThis.fetch = originalFetch;
  });

  it("should wrap credits API: balance, consume, and history", async () => {
    const sdk = new Tertaut({ appId: "app_credits_sdk", baseUrl: "http://localhost:3000" });
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
    const sdk = new Tertaut({ appId: "app_ai_sdk", baseUrl: "http://localhost:3000" });
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

    globalThis.fetch = originalFetch;
  });
});
