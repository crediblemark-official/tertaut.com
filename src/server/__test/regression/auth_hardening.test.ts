/**
 * Regression test untuk perbaikan autentikasi & hardening (2026-09-23):
 *  1. getClientIp: anti-spoofing header IP (rightmost hop + hormati TRUST_PROXY).
 *  2. isAdminUser: satu sumber kebenaran penentuan admin (role admin | ADMIN_EMAIL).
 *  3. GET /checkout/status: detail sensitif hanya untuk pemegang poll ticket valid;
 *     pemegang txId saja hanya menerima status (tanpa paymentCode/QR/amount/externalId).
 *  4. Free trial: anti-TOCTOU — dua permintaan paralel => tepat satu sukses (200),
 *     satu 409 (unique index uniq_transactions_trial_per_app_email).
 */
import { describe, it, expect, afterEach } from "bun:test";
import { setupTestAuth } from "../setup";
import { app } from "../../index";
import { db } from "../../db";
import { apps, builders, transactions, licenses } from "../../db/schema";
import { eq } from "drizzle-orm";
import { generateAppApiKey, generateBuilderSecretApiKey } from "../../routes/apps/api-key";
import { handleGetPaymentStatus } from "../../routes/checkout/handlers";
import { createPollTicket } from "../../utils/pollTicket";
import { getClientIp } from "../../lib/ip";
import { config } from "../../config";
import { isAdminUser } from "../../middleware/auth";

setupTestAuth();

const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function seedBuilderAndApp(overrides: Record<string, any> = {}) {
  const [b] = await db
    .insert(builders)
    .values({
      name: "AuthHardenBuilder",
      email: `authharden_${suffix()}@test.com`,
      apiKey: generateAppApiKey("live"),
      secretApiKey: generateBuilderSecretApiKey(),
    })
    .returning();
  const [a] = await db
    .insert(apps)
    .values({
      id: `app_authharden_${suffix()}`,
      name: "AuthHardenApp",
      slug: `authharden-${suffix()}`,
      builderId: b.id,
      targetPrice: 50000,
      mode: "sandbox",
      ...overrides,
    })
    .returning();
  return { builder: b, app: a };
}

async function cleanup(args: { appId: string; builderId: string; txIds?: string[] }) {
  for (const txId of args.txIds || []) {
    await db.delete(licenses).where(eq(licenses.transactionId, txId));
    await db.delete(transactions).where(eq(transactions.id, txId));
  }
  await db.delete(apps).where(eq(apps.id, args.appId));
  await db.delete(builders).where(eq(builders.id, args.builderId));
}

// ─────────────────────────────────────────────────────────────────────────────
describe("getClientIp — anti-spoofing header IP (rate limiter & audit)", () => {
  const originalTrustProxy = config.trustProxy;
  afterEach(() => {
    config.trustProxy = originalTrustProxy;
  });

  it("trustProxy aktif: pakai entry PALING KANAN x-forwarded-for (diisi proxy), bukan kiri yang bisa dipalsukan klien", () => {
    config.trustProxy = true;
    const ip = getClientIp({
      headers: { "x-forwarded-for": "6.6.6.6, 10.0.0.1" },
    } as any);
    expect(ip).toBe("10.0.0.1");
  });

  it("trustProxy aktif: hop non-IP diabaikan, hop IP terakhir dipakai", () => {
    config.trustProxy = true;
    const ip = getClientIp({
      headers: { "x-forwarded-for": "x-spoofed, 203.0.113.7, 10.1.2.3" },
    } as any);
    expect(ip).toBe("10.1.2.3");
  });

  it("trustProxy aktif: x-real-ip dipakai bila x-forwarded-for tidak ada", () => {
    config.trustProxy = true;
    const ip = getClientIp({ headers: { "x-real-ip": "172.16.0.9" } } as any);
    expect(ip).toBe("172.16.0.9");
  });

  it("trustProxy NONAKTIF: seluruh header IP klien diabaikan (tidak bisa spoofing)", () => {
    config.trustProxy = false;
    const ip = getClientIp({
      headers: {
        "x-forwarded-for": "1.1.1.1, 2.2.2.2",
        "cf-connecting-ip": "3.3.3.3",
        "x-real-ip": "4.4.4.4",
      },
    } as any);
    expect(ip).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("isAdminUser — satu sumber kebenaran penentuan admin", () => {
  const originalAdminEmail = process.env.ADMIN_EMAIL;
  afterEach(() => {
    if (originalAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = originalAdminEmail;
  });

  it("role 'admin' => true", () => {
    expect(isAdminUser({ role: "admin", email: "someone@tertaut.com" })).toBe(true);
  });

  it("email cocok dengan ADMIN_EMAIL => true walau role user (case-insensitive)", () => {
    process.env.ADMIN_EMAIL = "owner@tertaut.com";
    expect(isAdminUser({ role: "user", email: "OWNER@TERTAUT.COM" })).toBe(true);
  });

  it("role user tanpa ADMIN_EMAIL => false", () => {
    delete process.env.ADMIN_EMAIL;
    expect(isAdminUser({ role: "user", email: "member@tertaut.com" })).toBe(false);
  });

  it("tanpa role & email => false", () => {
    expect(isAdminUser({})).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("GET /checkout/status — detail pembayaran hanya untuk pemegang poll ticket", () => {
  it("tanpa ticket: hanya transactionId + paymentStatus (detail sensitif disembunyikan)", async () => {
    const { builder, app: a } = await seedBuilderAndApp();
    const txId = `tx_authharden_${suffix()}`;
    const [tx] = await db
      .insert(transactions)
      .values({
        id: txId,
        builderId: builder.id,
        appId: a.id,
        providerReferenceId: `ref_${suffix()}`,
        xenditExternalId: `ext_authharden_${suffix()}`,
        customerEmail: `buyer_${suffix()}@example.com`,
        grossAmount: 50000,
        netAmount: 47500,
        platformFee: 2500,
        paymentStatus: "PENDING",
        disbursementStatus: "PENDING",
        paymentChannel: "QRIS",
        paymentProvider: "manual", // hindari sinkronisasi status ke DANA di test
      })
      .returning();

    const set: any = {};
    const res: any = await handleGetPaymentStatus({
      params: { txId: tx.id },
      query: {},
      request: new Request(`http://localhost:3001/api/v1/checkout/status/${tx.id}`),
      set,
    });

    expect(res.success).toBe(true);
    expect(res.paymentStatus).toBe("PENDING");
    expect(res.transactionId).toBe(tx.id);
    // Detail sensitif TIDAK boleh bocor tanpa ticket:
    expect(res.externalId).toBeUndefined();
    expect(res.amount).toBeUndefined();
    expect(res.channel).toBeUndefined();
    expect(res.qrDataUrl).toBeUndefined();
    expect(res.paymentCode).toBeUndefined();
    expect(res.checkoutUrl).toBeUndefined();
    expect(res.licenseKey).toBeUndefined();

    await cleanup({ appId: a.id, builderId: builder.id, txIds: [tx.id] });
  });

  it("dengan ticket valid: detail sensitif dikembalikan", async () => {
    const { builder, app: a } = await seedBuilderAndApp();
    const txId = `tx_authharden_${suffix()}`;
    const [tx] = await db
      .insert(transactions)
      .values({
        id: txId,
        builderId: builder.id,
        appId: a.id,
        providerReferenceId: `ref_${suffix()}`,
        xenditExternalId: `ext_authharden_${suffix()}`,
        customerEmail: `buyer_${suffix()}@example.com`,
        grossAmount: 50000,
        netAmount: 47500,
        platformFee: 2500,
        paymentStatus: "PENDING",
        disbursementStatus: "PENDING",
        paymentChannel: "QRIS",
        paymentProvider: "manual",
      })
      .returning();
    const ticket = createPollTicket(tx.id);

    const set: any = {};
    const res: any = await handleGetPaymentStatus({
      params: { txId: tx.id },
      query: { ticket },
      request: new Request(`http://localhost:3001/api/v1/checkout/status/${tx.id}`),
      set,
    });

    expect(res.externalId).toBe(tx.xenditExternalId);
    expect(res.amount).toBe(50000);
    expect(res.channel).toBe("QRIS");
    expect(typeof res.paymentCode).toBe("string");
    expect(typeof res.qrDataUrl).toBe("string");

    await cleanup({ appId: a.id, builderId: builder.id, txIds: [tx.id] });
  });

  it("lisensi tidak bocor tanpa ticket walau transaksi PAID", async () => {
    const { builder, app: a } = await seedBuilderAndApp();
    const txId = `tx_authharden_${suffix()}`;
    const [tx] = await db
      .insert(transactions)
      .values({
        id: txId,
        builderId: builder.id,
        appId: a.id,
        providerReferenceId: `ref_${suffix()}`,
        xenditExternalId: `ext_authharden_${suffix()}`,
        customerEmail: `buyer_${suffix()}@example.com`,
        grossAmount: 50000,
        netAmount: 47500,
        platformFee: 2500,
        paymentStatus: "PAID",
        disbursementStatus: "COMPLETED",
        paymentProvider: "manual",
      })
      .returning();
    await db.insert(licenses).values({
      id: `lic_authharden_${suffix()}`,
      appId: a.id,
      transactionId: tx.id,
      customerEmail: tx.customerEmail,
      licenseKey: `AUTHHARDEN-KEY-${suffix()}`,
      status: "ACTIVE",
    });

    const set: any = {};
    const resNoTicket: any = await handleGetPaymentStatus({
      params: { txId: tx.id },
      query: {},
      request: new Request(`http://localhost:3001/api/v1/checkout/status/${tx.id}`),
      set,
    });
    expect(resNoTicket.licenseKey).toBeUndefined();

    const set2: any = {};
    const resWithTicket: any = await handleGetPaymentStatus({
      params: { txId: tx.id },
      query: { ticket: createPollTicket(tx.id) },
      request: new Request(`http://localhost:3001/api/v1/checkout/status/${tx.id}`),
      set: set2,
    });
    expect(typeof resWithTicket.licenseKey).toBe("string");

    await cleanup({ appId: a.id, builderId: builder.id, txIds: [tx.id] });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Free trial — anti-TOCTOU (satu trial per email per aplikasi)", () => {
  it("dua permintaan paralel: tepat satu sukses (200), satu bentrok (409)", async () => {
    const { builder, app: a } = await seedBuilderAndApp({
      trialPeriodDays: 7,
    });
    const email = `trial_${suffix()}@example.com`;

    const call = () =>
      app.handle(
        new Request(`http://localhost:8081/api/v1/checkout/session`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            appSlug: a.slug,
            customerEmail: email,
            startTrial: true,
          }),
        })
      );

    const responses = await Promise.all([call(), call()]);
    const statuses = responses.map((r) => r.status).sort((x, y) => x - y);
    expect(statuses).toEqual([200, 409]);

    // Pastikan hanya SATU lisensi trial yang terbit.
    const trialLicenses = await db.query.licenses.findMany({
      where: eq(licenses.appId, a.id),
    });
    expect(trialLicenses.length).toBe(1);

    await cleanup({
      appId: a.id,
      builderId: builder.id,
      txIds: trialLicenses.map((l) => l.transactionId).filter((id): id is string => Boolean(id)),
    });
  });
});
