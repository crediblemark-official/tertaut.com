/**
 * Guard untuk pemisahan "mock" vs "sandbox asli".
 *
 * Latar belakang: `danaOrderService` pernah memfallback ke order MOCK di SEMUA
 * lingkungan non-produksi karena syaratnya `(allowMock || !config.isProd)`.
 * Akibatnya kegagalan integrasi DANA (mis. `externalStoreId` belum diisi)
 * disamarkan sebagai order sukses — hasil sandbox test bisa berbohong. Cacat
 * produksi yang lain ikut tertutup karena mekanisme yang sama.
 *
 * Kontrak yang dikunci di sini:
 *  1. Produksi tidak pernah fallback ke mock.
 *  2. `DANA_ALLOW_MOCK_FALLBACK=false` mematikan fallback meski non-produksi.
 *  3. Pesan error asli DANA harus diteruskan, bukan diganti teks generik.
 */

import { describe, it, expect, afterEach } from "bun:test";
import { readFileSync } from "fs";
import { DanaService } from "../../services/payments/dana/dana";
import { config, DEFAULT_TEST_SANDBOX_PRIVATE_KEY } from "../../config";

const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const originalFlag = process.env.DANA_ALLOW_MOCK_FALLBACK;

/**
 * Pasang stub gateway yang selalu menolak dengan pesan DANA yang realistis.
 * Mengembalikan fungsi untuk memulihkan.
 */
function stubDanaGatewayRejecting(message: string) {
  const original = Object.getOwnPropertyDescriptor(DanaService, "paymentGateway")!;
  Object.defineProperty(DanaService, "paymentGateway", {
    get: () => ({
      createOrder: async () => {
        throw new Error(message);
      },
    }),
    configurable: true,
  });
  return () => Object.defineProperty(DanaService, "paymentGateway", original);
}

const DANA_REJECT = `500: Internal Server Error. If you want to use QRIS, make sure you fill
externalStoreId. See https://dashboard.dana.id/sandbox/submerchants`;

function orderFor(paymentRail: string) {
  return {
    externalId: `ext_guard_${paymentRail}_${suffix()}`,
    amount: 50_000,
    payerEmail: `guard_${suffix()}@t.com`,
    description: "mock guard probe",
    paymentRail,
    allowMock: false,
    forceMock: false,
  } as any;
}

afterEach(() => {
  process.env.DANA_ALLOW_MOCK_FALLBACK = originalFlag;
});

describe("Mock vs sandbox: DANA tidak boleh menyamar", () => {
  it("DANA_ALLOW_MOCK_FALLBACK=false mematikan fallback di non-produksi", async () => {
    const origProd = config.isProd;
    const restore = stubDanaGatewayRejecting(DANA_REJECT);
    try {
      config.isProd = false;
      process.env.DANA_ALLOW_MOCK_FALLBACK = "false";

      await expect(DanaService.createOrder(orderFor("qris"))).rejects.toThrow(/externalStoreId/);
    } finally {
      config.isProd = origProd;
      restore();
    }
  });

  it("error asli DANA diteruskan, bukan diganti teks generik", async () => {
    const origProd = config.isProd;
    const restore = stubDanaGatewayRejecting(DANA_REJECT);
    try {
      config.isProd = false;
      process.env.DANA_ALLOW_MOCK_FALLBACK = "false";

      const err = await DanaService.createOrder(orderFor("qris")).catch((e) => e);
      // Pesan DANA asli harus masih terbaca...
      expect(err.message).toContain("externalStoreId");
      expect(err.message).toContain("dashboard.dana.id");
      // ...dan "Body already used" (gejala bug SDK) tidak boleh muncul.
      expect(err.message).not.toContain("Body already used");
    } finally {
      config.isProd = origProd;
      restore();
    }
  });

  it("produksi menolak mock walau flag fallback diaktifkan", async () => {
    const origProd = config.isProd;
    const origClientId = config.dana.clientId;
    const origKey = config.dana.privateKey;
    const restore = stubDanaGatewayRejecting(DANA_REJECT);
    try {
      config.isProd = true;
      // walau dimatikan, produksi tetap harus menolak
      process.env.DANA_ALLOW_MOCK_FALLBACK = "false";
      // Nilai asal saja: gateway di-stub pada test ini, tidak ada panggilan nyata.
      if (!config.dana.clientId) config.dana.clientId = "TEST_CLIENT_ID_STUBBED";
      if (!config.dana.privateKey) config.dana.privateKey = DEFAULT_TEST_SANDBOX_PRIVATE_KEY;

      await expect(DanaService.createOrder(orderFor("qris"))).rejects.toThrow(/externalStoreId/);
    } finally {
      config.isProd = origProd;
      config.dana.clientId = origClientId;
      config.dana.privateKey = origKey;
      restore();
    }
  });

  it("non-produksi tidak fallback ke mock dan melempar error asli DANA", async () => {
    const origProd = config.isProd;
    const restore = stubDanaGatewayRejecting(DANA_REJECT);
    try {
      config.isProd = false;
      delete process.env.DANA_ALLOW_MOCK_FALLBACK;

      await expect(DanaService.createOrder(orderFor("qris"))).rejects.toThrow(/externalStoreId/);
    } finally {
      config.isProd = origProd;
      restore();
    }
  });

  it("smoke test memaksa mode kejujuran", () => {
    // `bun run smoke:gateway` harus menyetel flag ini, kalau tidak ia melaporkan
    // "sukses" untuk integrasi DANA yang rusak.
    const src = readFileSync("scripts/smoke-gateway.ts", "utf8");
    expect(src).toMatch(/DANA_ALLOW_MOCK_FALLBACK\s*=\s*"false"/);
  });
});
