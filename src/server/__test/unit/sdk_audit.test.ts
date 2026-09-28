/**
 * @tertaut/sdk — audit remediation tests
 *
 * Menegakkan kontrak yang sebelumnya menyimpang antara SDK dan server:
 *  1. Pipeline error bertipe (semula `errors.ts` adalah dead code).
 *  2. `modelAlias` default AI Proxy harus "default", bukan alias fiktif.
 *  3. `grantCredits` tidak boleh pernah dikirim dari klien.
 *  4. `environment` untuk secret key.
 *  5. Verifikasi offline token secara online.
 */

import { describe, it, expect, afterEach } from "bun:test";
import { Tertaut } from "../../../../packages/sdk/src/index";
import {
  TertautError,
  TertautRateLimitError,
  LicenseExpiredError,
  LicenseRevokedError,
  SeatLimitExceededError,
  HeartbeatLeaseError,
  InsufficientCreditsError,
  VersionFloorError,
  createTertautError,
  parseErrorPayload,
} from "../../../../packages/sdk/src/errors";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const makeSdk = () =>
  new Tertaut({ apiKey: "tt_live_audit", appId: "app_audit", baseUrl: "https://tertaut.com" });

const mockJson = (body: unknown, status = 200) => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as any;
};

describe("SDK error pipeline", () => {
  describe("parseErrorPayload — normalisasi envelope server", () => {
    it("membaca reason sebagai kode (rute licensing/s2s)", () => {
      expect(parseErrorPayload({ success: false, reason: "LICENSE_NOT_FOUND" })).toEqual({
        code: "LICENSE_NOT_FOUND",
        message: undefined,
      });
    });

    it("membaca errorCode sebagai kode (rute checkout)", () => {
      expect(parseErrorPayload({ error: "Kupon habis", errorCode: "COUPON_EXHAUSTED" })).toEqual({
        code: "COUPON_EXHAUSTED",
        message: "Kupon habis",
      });
    });

    it("membaca error UPPER_SNAKE sebagai kode, bukan pesan (AI proxy)", () => {
      expect(
        parseErrorPayload({
          success: false,
          error: "RATE_LIMIT_EXCEEDED",
          message: "Terlalu banyak",
        })
      ).toEqual({ code: "RATE_LIMIT_EXCEEDED", message: "Terlalu banyak" });
    });

    it("membaca envelope global Elysia { error: { code, message } }", () => {
      expect(
        parseErrorPayload({ error: { code: "NOT_FOUND", message: "Endpoint tidak ada" } })
      ).toEqual({ code: "NOT_FOUND", message: "Endpoint tidak ada" });
    });

    it("menganggap string apa adanya sebagai pesan", () => {
      expect(parseErrorPayload("Bad Gateway")).toEqual({ code: undefined, message: "Bad Gateway" });
    });
  });

  describe("createTertautError — pemetaan ke kelas typed", () => {
    it("APP_VERSION_TOO_OLD → VersionFloorError dengan minVersion", () => {
      const err = createTertautError(403, {
        valid: false,
        reason: "APP_VERSION_TOO_OLD",
        minVersion: "2.4.0",
        message: "Upgrade required",
      });
      expect(err).toBeInstanceOf(VersionFloorError);
      expect(err.code).toBe("APP_VERSION_TOO_OLD");
      expect(err.details.minVersion).toBe("2.4.0");
    });

    it("LICENSE_EXPIRED → LicenseExpiredError", () => {
      expect(createTertautError(403, { errorCode: "LICENSE_EXPIRED" })).toBeInstanceOf(
        LicenseExpiredError
      );
    });

    it("LICENSE_REVOKED / TOKEN_REVOKED → LicenseRevokedError", () => {
      expect(createTertautError(403, { reason: "LICENSE_REVOKED" })).toBeInstanceOf(
        LicenseRevokedError
      );
      expect(createTertautError(401, { reason: "TOKEN_REVOKED" })).toBeInstanceOf(
        LicenseRevokedError
      );
    });

    it("SEAT_FULL → SeatLimitExceededError", () => {
      expect(createTertautError(403, { errorCode: "SEAT_FULL" })).toBeInstanceOf(
        SeatLimitExceededError
      );
    });

    it("LEASE_MISMATCH / LEASE_STALE → HeartbeatLeaseError dengan code asli", () => {
      const mismatch = createTertautError(409, { reason: "LEASE_MISMATCH" });
      expect(mismatch).toBeInstanceOf(HeartbeatLeaseError);
      expect(mismatch.code).toBe("LEASE_MISMATCH");
      expect(mismatch.status).toBe(409);

      expect(createTertautError(200, { reason: "LEASE_STALE" })).toBeInstanceOf(
        HeartbeatLeaseError
      );
    });

    it("INSUFFICIENT_CREDITS → InsufficientCreditsError (402 maupun 409)", () => {
      expect(createTertautError(402, { reason: "INSUFFICIENT_CREDITS" })).toBeInstanceOf(
        InsufficientCreditsError
      );
      // S2S memakai 409 untuk kondisi yang sama.
      expect(createTertautError(409, { reason: "INSUFFICIENT_CREDITS" })).toBeInstanceOf(
        InsufficientCreditsError
      );
    });

    it("429 tanpa kode eksplisit tetap menjadi TertautRateLimitError + retryAfter", () => {
      const err = createTertautError(429, {
        success: false,
        error: "Terlalu banyak permintaan.",
        retryAfter: 42,
      });
      expect(err).toBeInstanceOf(TertautRateLimitError);
      expect((err as TertautRateLimitError).retryAfter).toBe(42);
    });

    it("status 402 tanpa kode tetap menjadi InsufficientCreditsError", () => {
      expect(createTertautError(402, { error: "Saldo kurang" })).toBeInstanceOf(
        InsufficientCreditsError
      );
    });

    it("kode tak dikenal → TertautError generik dengan status & payload", () => {
      const err = createTertautError(
        503,
        { error: "AI_PROXY_UNAVAILABLE", path: "/api/v1/ai/chat" },
        {
          path: "/api/v1/ai/chat",
        }
      );
      expect(err.constructor).toBe(TertautError);
      expect(err.status).toBe(503);
      expect(err.code).toBe("AI_PROXY_UNAVAILABLE");
      expect(err.details.path).toBe("/api/v1/ai/chat");
    });

    it("body non-JSON tidak membuat factory melempar", () => {
      const err = createTertautError(502, undefined, {
        path: "/x",
        statusText: "Bad Gateway",
      });
      expect(err.message).toBe("Bad Gateway");
    });
  });

  describe("Modul melempar typed error saat HTTP >= 400", () => {
    it("licensing.activate dengan seat penuh → SeatLimitExceededError", async () => {
      mockJson(
        {
          success: false,
          error: "Device seats quota exceeded (2/2). Please deactivate another device first.",
          errorCode: "SEAT_FULL",
        },
        403
      );
      const sdk = makeSdk();
      await expect(
        sdk.licensing.activate({ licenseKey: "TT-1", hwid: "HW-1" })
      ).rejects.toBeInstanceOf(SeatLimitExceededError);
    });

    it("licensing.heartbeat dengan lease hilang → HeartbeatLeaseError", async () => {
      mockJson(
        {
          success: false,
          error: "Lease tidak ditemukan atau leaseKey tidak valid untuk perangkat ini.",
          reason: "LEASE_MISMATCH",
        },
        409
      );
      const sdk = makeSdk();
      await expect(
        sdk.licensing.heartbeat({ licenseKey: "TT-1", hwid: "HW-1", leaseKey: "lease_x" })
      ).rejects.toBeInstanceOf(HeartbeatLeaseError);
    });

    it("credits.consume dengan saldo kurang → InsufficientCreditsError", async () => {
      mockJson(
        { success: false, reason: "INSUFFICIENT_CREDITS", balance: 0, message: "Saldo kurang" },
        402
      );
      const sdk = makeSdk();
      await expect(
        sdk.credits.consume({ licenseKey: "TT-1", hwid: "HW-1", amount: 10 })
      ).rejects.toBeInstanceOf(InsufficientCreditsError);
    });

    it("credits.balance yang kena rate limit → TertautRateLimitError", async () => {
      mockJson({ success: false, reason: "RATE_LIMITED", message: "Terlalu cepat" }, 429);
      const sdk = makeSdk();
      const err = await sdk.credits.balance({ licenseKey: "TT-1" }).catch((e) => e);
      expect(err).toBeInstanceOf(TertautRateLimitError);
    });

    it("validate dengan versi usang → VersionFloorError", async () => {
      mockJson(
        {
          valid: false,
          status: "APP_VERSION_TOO_OLD",
          reason: "APP_VERSION_TOO_OLD",
          minVersion: "2.4.0",
          currentVersion: "2.0.1",
          message: "Upgrade required",
        },
        403
      );
      const sdk = makeSdk();
      await expect(sdk.licensing.validate({ licenseKey: "TT-1" })).rejects.toBeInstanceOf(
        VersionFloorError
      );
    });

    it("aiProxy.chatStream error 429 tetap melempar dengan pesan server", async () => {
      mockJson(
        { success: false, error: "RATE_LIMIT_EXCEEDED", message: "Daily limit exceeded" },
        429
      );
      const sdk = makeSdk();
      await expect(sdk.aiProxy.chatStream({ licenseKey: "TT-1", prompt: "hi" })).rejects.toThrow(
        "Daily limit exceeded"
      );
    });

    it("respons 2xx dengan success:false TIDAK dilempar (jawaban bisnis, bukan kegagalan)", async () => {
      mockJson({ valid: false, status: "DEVICE_NOT_ACTIVATED" }, 200);
      const sdk = makeSdk();
      const res = await sdk.licensing.validate({ licenseKey: "TT-1" });
      expect(res.valid).toBe(false);
      expect(res.status).toBe("DEVICE_NOT_ACTIVATED");
    });

    it("semua kelas error tetap instanceof TertautError", () => {
      for (const Klass of [
        LicenseExpiredError,
        LicenseRevokedError,
        SeatLimitExceededError,
        HeartbeatLeaseError,
        InsufficientCreditsError,
        VersionFloorError,
        TertautRateLimitError,
      ]) {
        expect(new Klass()).toBeInstanceOf(TertautError);
      }
    });
  });

  describe("Perbaikan kontrak hasil audit", () => {
    it("A1: AI Proxy memakai modelAlias 'default', bukan alias fiktif", async () => {
      let sentBody: any;
      globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        sentBody = JSON.parse(init!.body as string);
        return new Response(JSON.stringify({ text: "ok" }), { status: 200 });
      }) as any;

      const sdk = makeSdk();
      await sdk.aiProxy.chat({ licenseKey: "TT-1", prompt: "hi" });
      expect(sentBody.modelAlias).toBe("default");

      await sdk.aiProxy.chatStream({ licenseKey: "TT-1", prompt: "hi" }).catch(() => {});
      expect(sentBody.modelAlias).toBe("default");

      // Alias eksplitasikan harus dihormati apa adanya
      await sdk.aiProxy.chat({ licenseKey: "TT-1", prompt: "hi", modelAlias: "fastmail-summary" });
      expect(sentBody.modelAlias).toBe("fastmail-summary");
    });

    it("A1: quotaStatus memakai modelAlias 'default'", async () => {
      let seenUrl = "";
      globalThis.fetch = (async (url: string) => {
        seenUrl = url;
        return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
      }) as any;

      await makeSdk().aiProxy.quotaStatus({ licenseKey: "TT-1" });
      expect(seenUrl).toContain("modelAlias=default");
    });

    it("A2: checkout tidak pernah mengirim grantCredits dari klien", async () => {
      let sentBody: any;
      globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        sentBody = JSON.parse(init!.body as string);
        return new Response(JSON.stringify({ checkoutUrl: "https://pay", transactionId: "tx_1" }), {
          status: 200,
        });
      }) as any;

      await makeSdk().checkout({ customerEmail: "a@b.com", amount: 1000 });
      expect(sentBody).not.toHaveProperty("grantCredits");
    });

    it("A2: opsi grantCredits tidak lagi ada di tipe CheckoutOptions", () => {
      // `@ts-expect-error` itu sendiri adalah assertion: bila `grantCredits`
      // masih ada di tipe, direktif ini jadi "unused" dan tsc gagal saat typecheck.
      const opts: import("../../../../packages/sdk/src/types").CheckoutOptions = {
        customerEmail: "a@b.com",
        // @ts-expect-error grantCredits dihapus — server mengambilnya dari meteringConfig produk
        grantCredits: 9999,
      };
      expect(opts.customerEmail).toBe("a@b.com");
    });

    it("A5: paymentRail mendukung card & retail sesuai server", () => {
      const rails = ["qris", "va", "ewallet", "card", "retail"] as const;
      for (const rail of rails) {
        const opts: import("../../../../packages/sdk/src/types").CheckoutOptions = {
          customerEmail: "a@b.com",
          paymentRail: rail,
        };
        expect(opts.paymentRail).toBe(rail);
      }
    });

    it("A7: environment 'server' untuk tt_secret_, bukan 'sandbox'", () => {
      const s2s = new Tertaut({ apiKey: "tt_secret_abc", baseUrl: "https://tertaut.com" });
      expect(s2s.environment).toBe("server");

      const prod = new Tertaut({
        apiKey: "tt_live_abc",
        appId: "app_1",
        baseUrl: "https://tertaut.com",
      });
      expect(prod.environment).toBe("production");

      const sandbox = new Tertaut({
        apiKey: "tt_test_abc",
        appId: "app_1",
        baseUrl: "https://tertaut.com",
      });
      expect(sandbox.environment).toBe("sandbox");
    });

    it("A7: secret key tetap tidak memerlukan appId", () => {
      expect(
        () => new Tertaut({ apiKey: "tt_secret_abc", baseUrl: "https://tertaut.com" })
      ).not.toThrow();
    });

    it("A9: verifyOfflineTokenOnline memanggil endpoint denylist server", async () => {
      let seenUrl = "";
      let sentBody: any;
      globalThis.fetch = (async (url: string, init?: RequestInit) => {
        seenUrl = url;
        sentBody = JSON.parse(init!.body as string);
        return new Response(
          JSON.stringify({ valid: true, licenseKey: "TT-1", mode: "OFFLINE_GRACE_ACTIVE" }),
          { status: 200 }
        );
      }) as any;

      const res = await makeSdk().licensing.verifyOfflineTokenOnline("a.b.c");
      expect(seenUrl).toBe("https://tertaut.com/api/v1/licensing/verify-offline-token");
      expect(sentBody).toEqual({ token: "a.b.c" });
      expect(res.valid).toBe(true);
    });

    it("A9: token yang sudah dicabut → LicenseRevokedError dari endpoint online", async () => {
      mockJson({ valid: false, reason: "TOKEN_REVOKED" }, 401);
      await expect(makeSdk().licensing.verifyOfflineTokenOnline("a.b.c")).rejects.toBeInstanceOf(
        LicenseRevokedError
      );
    });

    it("heartbeat menormalkan leaseExpiresAt menjadi expiresAt", async () => {
      mockJson({
        success: true,
        floating: true,
        leaseKey: "lease_1",
        leaseExpiresAt: "2026-10-01T00:00:00.000Z",
        lastHeartbeatAt: "2026-09-28T00:00:00.000Z",
        seatsUsed: 1,
        status: "ACTIVE",
      });
      const res = await makeSdk().licensing.heartbeat({
        licenseKey: "TT-1",
        hwid: "HW-1",
        leaseKey: "lease_1",
      });
      expect(res.expiresAt).toBe("2026-10-01T00:00:00.000Z");
      expect(res.leaseExpiresAt).toBe("2026-10-01T00:00:00.000Z");
    });

    it("A8: verifyWebhookSignature menolak signature dengan panjang berbeda", async () => {
      const body = JSON.stringify({ event: "license.issued" });
      const secret = "whsec_audit";
      const { createHmac } = await import("crypto");
      const valid = createHmac("sha256", secret).update(body).digest("hex");

      expect(await Tertaut.verifyWebhookSignature(body, `hmac-sha256=${valid}`, secret)).toBe(true);
      // Prefix terpotong
      expect(await Tertaut.verifyWebhookSignature(body, valid.slice(0, 10), secret)).toBe(false);
      // Tanpa prefix juga diterima
      expect(await Tertaut.verifyWebhookSignature(body, valid, secret)).toBe(true);
    });
  });
});
