/**
 * Regression test untuk 6 perbaikan keamanan:
 *  1. BUG-1: finish ?mock=true hanya mem-fulfill transaksi mockOrder=true di app sandbox.
 *     Aplikasi Live di PRODUKSI tidak pernah menghasilkan mock (session, createOrder,
 *     & finish). Di deployment non-produksi app Live boleh mendapat invoice DEMO
 *     (mock:true) tetapi dicatat mockOrder=false → tidak pernah bisa mem-fulfill lisensi.
 *  2. BUG-2: webhook wajib rekonsiliasi nominal amount vs grossAmount.
 *  3. BUG-3: signature webhook wajib ketika public key DANA terpasang (semua env).
 *  4. BUG-4: simulate-paid butuh autentikasi (tidak lagi publik).
 *  5. BUG-5: status endpoint hanya membocorkan licenseKey dengan poll ticket valid.
 *  6. BUG-6: rate limit pada /checkout/session.
 */
import { describe, it, expect } from "bun:test";
import { setupTestAuth, danaWebhookHeaders } from "../setup";
import { app } from "../../index";
import { db } from "../../db";
import { apps, builders, transactions, licenses } from "../../db/schema";
import { eq } from "drizzle-orm";
import { generateAppApiKey, generateBuilderSecretApiKey } from "../../routes/apps/api-key";
import { handleDanaFinish, handleGetPaymentStatus } from "../../routes/checkout/handlers";
import { handleDanaFinishPaymentWebhook } from "../../routes/webhook/dana";
import { fulfillPaymentTransaction } from "../../routes/webhook/fulfill";
import { createPollTicket } from "../../utils/pollTicket";

setupTestAuth();

const BASE = "http://localhost:3001";
const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function seedBuilderApp(mode: "live" | "sandbox" = "live") {
  const [b] = await db
    .insert(builders)
    .values({
      name: "SecFixBuilder",
      email: `secfix_${suffix()}@test.com`,
      apiKey: generateAppApiKey("live"),
      secretApiKey: generateBuilderSecretApiKey(),
    })
    .returning();

  const [a] = await db
    .insert(apps)
    .values({
      id: `app_secfix_${suffix()}`,
      name: "SecFixApp",
      slug: `secfix-${suffix()}`,
      builderId: b.id,
      targetPrice: 50000,
      mode,
    })
    .returning();

  return { builder: b, app: a };
}

async function createTx(
  builderId: string,
  appId: string,
  extras: Record<string, any> = {}
): Promise<any> {
  const txId = `tx_secfix_${suffix()}`;
  const [tx] = await db
    .insert(transactions)
    .values({
      id: txId,
      builderId,
      appId,
      providerReferenceId: `ref_${suffix()}`,
      xenditExternalId: `ext_secfix_${suffix()}`,
      customerEmail: `secfix_${suffix()}@example.com`,
      grossAmount: 50000,
      netAmount: 47500,
      platformFee: 2500,
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
      ...extras,
    })
    .returning();
  return tx;
}

async function cleanupTx(txId: string) {
  await db.delete(licenses).where(eq(licenses.transactionId, txId));
  await db.delete(transactions).where(eq(transactions.id, txId));
}

// ─────────────────────────────────────────────────────────────────────────────
describe("Regression BUG-1: finish ?mock=true hanya untuk transaksi mockOrder", () => {
  it("transaksi non-mock TIDAK di-fulfill oleh ?mock=true", async () => {
    const { builder, app: a } = await seedBuilderApp("live");
    const tx = await createTx(builder.id, a.id, { mockOrder: false });

    const set: any = {};
    await handleDanaFinish({
      query: { externalId: tx.xenditExternalId, mock: "true" },
      request: new Request(`${BASE}/checkout/dana/finish`),
      set,
    });

    const updated = await db.query.transactions.findFirst({ where: eq(transactions.id, tx.id) });
    expect(updated?.paymentStatus).toBe("PENDING");

    const lic = await db.query.licenses.findFirst({ where: eq(licenses.transactionId, tx.id) });
    expect(lic).toBeUndefined();

    await cleanupTx(tx.id);
    await db.delete(apps).where(eq(apps.id, a.id));
    await db.delete(builders).where(eq(builders.id, builder.id));
  });

  it("transaksi mock (mockOrder=true) tetap di-fulfill oleh ?mock=true", async () => {
    const { builder, app: a } = await seedBuilderApp("sandbox");
    const tx = await createTx(builder.id, a.id, { mockOrder: true });

    const set: any = {};
    const res: any = await handleDanaFinish({
      query: { externalId: tx.xenditExternalId, mock: "true" },
      request: new Request(`${BASE}/checkout/dana/finish`),
      set,
    });

    const updated = await db.query.transactions.findFirst({ where: eq(transactions.id, tx.id) });
    expect(updated?.paymentStatus).toBe("PAID");
    expect(res.paymentStatus).toBe("PAID");

    await cleanupTx(tx.id);
    await db.delete(apps).where(eq(apps.id, a.id));
    await db.delete(builders).where(eq(builders.id, builder.id));
  });

  it("transaksi Live dengan mockOrder=true (data legacy) TETAP tidak di-fulfill oleh ?mock=true", async () => {
    // Guard ganda: kolom mockOrder saja tidak cukup — app wajib mode sandbox.
    const { builder, app: a } = await seedBuilderApp("live");
    const tx = await createTx(builder.id, a.id, { mockOrder: true });

    const set: any = {};
    await handleDanaFinish({
      query: { externalId: tx.xenditExternalId, mock: "true" },
      request: new Request(`${BASE}/checkout/dana/finish`),
      set,
    });

    const updated = await db.query.transactions.findFirst({ where: eq(transactions.id, tx.id) });
    expect(updated?.paymentStatus).toBe("PENDING");

    await cleanupTx(tx.id);
    await db.delete(apps).where(eq(apps.id, a.id));
    await db.delete(builders).where(eq(builders.id, builder.id));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Regression BUG-1 lanjutan: aplikasi Live tidak pernah menghasilkan mock", () => {
  it("createOrder menolak forceMock untuk aplikasi Live (allowMock=false) di PRODUCTION", async () => {
    const { DanaService } = await import("../../services/dana");
    const { config } = await import("../../config");
    const origProd = (config as any).isProd;
    (config as any).isProd = true;
    try {
      await expect(
        (DanaService.createOrder as any)({
          externalId: `ext_guard_${suffix()}`,
          amount: 50000,
          payerEmail: `guard_${suffix()}@t.com`,
          description: "live forceMock guard",
          forceMock: true,
          allowMock: false,
        })
      ).rejects.toThrow(/Mock order ditolak/);
    } finally {
      (config as any).isProd = origProd;
    }
  });

  it("createOrder: app Live di NON-PRODUKSI boleh forceMock → invoice DEMO (mock:true, tak di-fulfill session)", async () => {
    const { DanaService } = await import("../../services/dana");
    const { config } = await import("../../config");
    const origProd = (config as any).isProd;
    (config as any).isProd = false;
    try {
      const res = await (DanaService.createOrder as any)({
        externalId: `ext_demo_${suffix()}`,
        amount: 50000,
        payerEmail: `demo_${suffix()}@t.com`,
        description: "live demo invoice",
        forceMock: true,
        allowMock: false,
      });
      expect(res.mock).toBe(true);
      expect(res.checkoutUrl).toContain("mock=true");
    } finally {
      (config as any).isProd = origProd;
    }
  });

  it("createOrder fallback QRIS Invalid Merchant: app Live non-prod → invoice DEMO; prod → THROW", async () => {
    const { DanaService } = await import("../../services/dana");
    const { config } = await import("../../config");
    const origProd = (config as any).isProd;
    const origGet = Object.getOwnPropertyDescriptor(DanaService, "paymentGateway")!;
    const gatewayErr = new Error(
      "404: Invalid Merchant. ... make sure externalStoreId / subMerchant exists. ... https://dashboard.dana.id/sandbox/submerchants"
    );
    Object.defineProperty(DanaService, "paymentGateway", {
      get: () => ({
        createOrder: async () => {
          throw gatewayErr;
        },
      }),
      configurable: true,
    });
    const restore = () => Object.defineProperty(DanaService, "paymentGateway", origGet);

    try {
      // Non-produksi: fallback demo menyala walau app Live.
      (config as any).isProd = false;
      const demo = await (DanaService.createOrder as any)({
        externalId: `ext_qris_np_${suffix()}`,
        amount: 50000,
        payerEmail: `qrisnp_${suffix()}@t.com`,
        description: "qris fallback non-prod",
        paymentRail: "qris",
        allowMock: false,
      });
      expect(demo.mock).toBe(true);
      expect(demo.qrDataUrl).toBeDefined();

      // Produksi: wajib meneruskan error asli (tidak ada mock untuk app Live).
      (config as any).isProd = true;
      await expect(
        (DanaService.createOrder as any)({
          externalId: `ext_qris_p_${suffix()}`,
          amount: 50000,
          payerEmail: `qrisp_${suffix()}@t.com`,
          description: "qris fallback prod",
          paymentRail: "qris",
          allowMock: false,
        })
      ).rejects.toThrow(/Invalid Merchant/);
    } finally {
      restore();
      (config as any).isProd = origProd;
    }
  });

  it("session app LIVE: mockOrder selalu false walau createOrder mengembalikan mock:true", async () => {
    const { DanaService } = await import("../../services/dana");
    const { handleCreateSession } = await import("../../routes/checkout/session");
    const orig = DanaService.createOrder;
    // Stub: bayangkan createOrder (mis. fallback QRIS lama) mengembalikan mock:true
    // untuk aplikasi live — session tetap harus menolak mencatatnya sebagai mock.
    (DanaService as any).createOrder = (async (p: any) => ({
      orderId: "dana_order_stub",
      externalId: p.externalId,
      status: "INIT",
      merchantName: "stub",
      amount: p.amount,
      payerEmail: p.payerEmail,
      description: p.description,
      checkoutUrl: `${BASE}/pay/stub?externalId=${p.externalId}&mock=true`,
      expiryDate: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      scenario: "API",
      paymentRail: "qris",
      mock: true,
    })) as any;

    const { builder, app: a } = await seedBuilderApp("live");
    try {
      const set: any = {};
      const res: any = await handleCreateSession({
        request: new Request(`${BASE}/checkout/session`),
        body: { appId: a.id, amount: 50000, customerEmail: `live_mock_${suffix()}@t.com` },
        set,
      });
      expect(res.success).toBe(true);

      const tx = await db.query.transactions.findFirst({
        where: eq(transactions.id, res.transactionId),
      });
      expect(tx?.mockOrder).toBe(false);
      expect(tx?.paymentStatus).toBe("PENDING");

      await db.delete(transactions).where(eq(transactions.id, res.transactionId));
    } finally {
      (DanaService as any).createOrder = orig;
      await db.delete(apps).where(eq(apps.id, a.id));
      await db.delete(builders).where(eq(builders.id, builder.id));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Regression BUG-2: webhook wajib cocokkan nominal", () => {
  it("amount TIDAK cocok dengan grossAmount → transaksi tetap PENDING", async () => {
    const { builder, app: a } = await seedBuilderApp();
    const tx = await createTx(builder.id, a.id); // grossAmount 50000

    const body = {
      partnerReferenceNo: tx.xenditExternalId,
      status: "PAID",
      amount: { value: "1" },
    };
    const res: any = await handleDanaFinishPaymentWebhook({
      request: new Request(`${BASE}/webhook/dana/finish-payment`),
      headers: danaWebhookHeaders(body),
      body,
      set: {},
    });

    expect(res.message).toBe("AMOUNT_MISMATCH");
    const updated = await db.query.transactions.findFirst({ where: eq(transactions.id, tx.id) });
    expect(updated?.paymentStatus).toBe("PENDING");

    await cleanupTx(tx.id);
    await db.delete(apps).where(eq(apps.id, a.id));
    await db.delete(builders).where(eq(builders.id, builder.id));
  });

  it("amount cocok → transaksi di-fulfill", async () => {
    const { builder, app: a } = await seedBuilderApp();
    const tx = await createTx(builder.id, a.id); // grossAmount 50000

    const body = {
      partnerReferenceNo: tx.xenditExternalId,
      status: "PAID",
      amount: { value: "50000.00" },
    };
    const res: any = await handleDanaFinishPaymentWebhook({
      request: new Request(`${BASE}/webhook/dana/finish-payment`),
      headers: danaWebhookHeaders(body),
      body,
      set: {},
    });

    expect(res.status).toBe("success");
    const updated = await db.query.transactions.findFirst({ where: eq(transactions.id, tx.id) });
    expect(updated?.paymentStatus).toBe("PAID");

    await cleanupTx(tx.id);
    await db.delete(apps).where(eq(apps.id, a.id));
    await db.delete(builders).where(eq(builders.id, builder.id));
  });

  it("webhook TANPA info nominal pada transaksi PENDING → ditolak (tidak di-fulfill)", async () => {
    const { builder, app: a } = await seedBuilderApp();
    const tx = await createTx(builder.id, a.id);

    const body = {
      partnerReferenceNo: tx.xenditExternalId,
      status: "PAID",
    };
    const res: any = await handleDanaFinishPaymentWebhook({
      request: new Request(`${BASE}/webhook/dana/finish-payment`),
      headers: danaWebhookHeaders(body),
      body,
      set: {},
    });

    expect(res.message).toBe("AMOUNT_MISMATCH");
    const updated = await db.query.transactions.findFirst({ where: eq(transactions.id, tx.id) });
    expect(updated?.paymentStatus).toBe("PENDING");

    await cleanupTx(tx.id);
    await db.delete(apps).where(eq(apps.id, a.id));
    await db.delete(builders).where(eq(builders.id, builder.id));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Regression BUG-3: signature wajib saat public key terpasang", () => {
  it("webhook tanpa signature ditolak 401 (public key terpasang di env)", async () => {
    const { config } = await import("../../config");
    if (!config.dana.publicKey) return; // env tanpa key → bypass sandbox sah, skip

    const set: any = {};
    const res: any = await handleDanaFinishPaymentWebhook({
      request: new Request(`${BASE}/webhook/dana/finish-payment`),
      headers: {},
      body: {
        partnerReferenceNo: "ext_should_be_rejected",
        status: "PAID",
        amount: { value: "100000" },
      },
      set,
    });

    expect(set.status).toBe(401);
    expect(res.responseCode).toBe("4015600");
  });

  it("webhook dengan signature palsu ditolak 401", async () => {
    const { config } = await import("../../config");
    if (!config.dana.publicKey) return;

    const set: any = {};
    const res: any = await handleDanaFinishPaymentWebhook({
      request: new Request(`${BASE}/webhook/dana/finish-payment`),
      headers: { signature: "palsu_signature_tanpa_private_key" },
      body: { partnerReferenceNo: "ext_fake_sig", status: "PAID", amount: { value: "100000" } },
      set,
    });

    expect(set.status).toBe(401);
    expect(res.responseCode).toBe("4015600");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Regression BUG-4: simulate-paid tidak lagi publik", () => {
  it("POST /api/v1/checkout/simulate-paid tanpa auth → 401", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/v1/checkout/simulate-paid/tx_tanpa_auth_${suffix()}`, {
        method: "POST",
      })
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Regression BUG-5: status butuh poll ticket untuk licenseKey", () => {
  it("tanpa ticket → licenseKey null; dengan ticket valid → licenseKey terungkap", async () => {
    const { builder, app: a } = await seedBuilderApp();
    const tx = await createTx(builder.id, a.id);
    await fulfillPaymentTransaction(tx, "QRIS");

    const paid = await db.query.transactions.findFirst({ where: eq(transactions.id, tx.id) });
    expect(paid?.paymentStatus).toBe("PAID");
    const lic = await db.query.licenses.findFirst({ where: eq(licenses.transactionId, tx.id) });
    expect(lic).toBeDefined();

    // Tanpa ticket → status PAID tapi licenseKey disembunyikan
    const resNoTicket = await app.handle(new Request(`${BASE}/api/v1/checkout/status/${tx.id}`));
    const bodyNoTicket: any = await resNoTicket.json();
    expect(bodyNoTicket.paymentStatus).toBe("PAID");
    expect(bodyNoTicket.licenseKey).toBeNull();

    // Ticket salah (di-tamper) → tetap disembunyikan
    const resBadTicket = await app.handle(
      new Request(
        `${BASE}/api/v1/checkout/status/${tx.id}?ticket=${tx.id}.9999999999999.${"ab".repeat(32)}`
      )
    );
    const bodyBadTicket: any = await resBadTicket.json();
    expect(bodyBadTicket.licenseKey).toBeNull();

    // Ticket valid → licenseKey kembali dibawa
    const ticket = createPollTicket(tx.id);
    const resWithTicket = await app.handle(
      new Request(`${BASE}/api/v1/checkout/status/${tx.id}?ticket=${encodeURIComponent(ticket)}`)
    );
    const bodyWithTicket: any = await resWithTicket.json();
    expect(bodyWithTicket.paymentStatus).toBe("PAID");
    expect(bodyWithTicket.licenseKey).toBe(lic!.licenseKey);

    // Handler juga menerima ticket via query object langsung
    const directSet: any = {};
    const direct: any = await handleGetPaymentStatus({
      params: { txId: tx.id },
      query: { ticket },
      request: new Request(`${BASE}/checkout/status/${tx.id}`),
      set: directSet,
    });
    expect(direct.licenseKey).toBe(lic!.licenseKey);

    await cleanupTx(tx.id);
    await db.delete(apps).where(eq(apps.id, a.id));
    await db.delete(builders).where(eq(builders.id, builder.id));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Regression BUG-6: rate limit /checkout/session", () => {
  it("lebih dari 60 request per menit → 429", async () => {
    // 60 request pertama (tanpa appId → validasi 400) tetap lolos rate limit
    for (let i = 0; i < 60; i++) {
      const res = await app.handle(
        new Request(`${BASE}/api/v1/checkout/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}), // tanpa appId → 400 sebelum rate limit tercapai
        })
      );
      expect([400, 429]).toContain(res.status);
    }
    // Request ke-61 harus kena 429
    const res61 = await app.handle(
      new Request(`${BASE}/api/v1/checkout/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res61.status).toBe(429);
  });
});
