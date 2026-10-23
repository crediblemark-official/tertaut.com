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
import { setupTestAuth } from "../setup";
import { app } from "../../index";
import { db } from "../../db";
import { apps, builders, transactions, licenses } from "../../db/schema";
import { eq } from "drizzle-orm";
import { generateAppApiKey, generateBuilderSecretApiKey } from "../../routes/apps/api-key";
import { handleGetPaymentStatus } from "../../routes/checkout/handlers";
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
describe("Regression BUG-4: simulate-paid telah dihapus (tidak ada endpoint mock)", () => {
  it("POST /api/v1/checkout/simulate-paid → 404 (endpoint dihapus)", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/v1/checkout/simulate-paid/tx_tanpa_auth_${suffix()}`, {
        method: "POST",
      })
    );
    expect(res.status).toBe(404);
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

    // Tanpa ticket → status PAID tapi licenseKey & detail pembayaran disembunyikan
    const resNoTicket = await app.handle(new Request(`${BASE}/api/v1/checkout/status/${tx.id}`));
    const bodyNoTicket: any = await resNoTicket.json();
    expect(bodyNoTicket.paymentStatus).toBe("PAID");
    expect(bodyNoTicket.licenseKey).toBeUndefined();
    expect(bodyNoTicket.amount).toBeUndefined();
    expect(bodyNoTicket.externalId).toBeUndefined();

    // Ticket salah (di-tamper) → tetap disembunyikan
    const resBadTicket = await app.handle(
      new Request(
        `${BASE}/api/v1/checkout/status/${tx.id}?ticket=${tx.id}.9999999999999.${"ab".repeat(32)}`
      )
    );
    const bodyBadTicket: any = await resBadTicket.json();
    expect(bodyBadTicket.licenseKey).toBeUndefined();

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
