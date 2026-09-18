import { describe, it, expect } from "bun:test";
import { setupTestAuth, authCookie } from "../setup";
import { CreditService } from "../../services/credits";
import { LicenseService } from "../../services/license";
import { db } from "../../db";
import { apps, licenses, transactions, creditLedger } from "../../db/schema";
import { eq } from "drizzle-orm";
import { config } from "../../config";
import { handleXenditInvoiceWebhook } from "../../routes/webhook/xendit";

setupTestAuth();

describe("Credit Ledger (grantCredits enforcement)", () => {
  it("should grant credits on payment fulfillment and report balance via verify", async () => {
    const app = await db.query.apps.findFirst();
    if (!app) return;

    const txId = `tx_credit_${Date.now()}`;
    const extId = `tt_credit_${Date.now()}`;

    await db.insert(transactions).values({
      id: txId,
      appId: app.id,
      builderId: app.builderId,
      xenditInvoiceId: `inv_${txId}`,
      xenditExternalId: extId,
      customerEmail: "credit_buyer@tertaut.com",
      grossAmount: 100000,
      platformFee: 5000,
      netAmount: 95000,
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
      grantCredits: 100,
    });

    try {
      const result: any = await handleXenditInvoiceWebhook({
        headers: { "x-callback-token": config.xendit.webhookToken || "" },
        body: { id: `inv_${txId}`, external_id: extId, status: "PAID", payment_method: "QRIS" },
        set: {},
      });

      expect(result.status).toBe("success");
      expect(result.grantedCredits).toBe(100);
      expect(result.creditBalance).toBe(100);

      const lic = await db.query.licenses.findFirst({ where: eq(licenses.transactionId, txId) });
      expect(lic).toBeDefined();

      const entries = await db.query.creditLedger.findMany({
        where: eq(creditLedger.licenseId, lic!.id),
      });
      expect(entries.length).toBe(1);
      expect(entries[0].type).toBe("GRANT");
      expect(entries[0].delta).toBe(100);
      expect(entries[0].balanceAfter).toBe(100);
      expect(await CreditService.getBalance(lic!.id)).toBe(100);

      const verifyRes = await fetch("http://localhost:3000/api/v1/licensing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: lic!.licenseKey }),
      });
      const verifyBody: any = await verifyRes.json();
      expect(verifyBody.valid).toBe(true);
      expect(verifyBody.credits).toBe(100);
    } finally {
      const lic = await db.query.licenses.findFirst({ where: eq(licenses.transactionId, txId) });
      if (lic) await db.delete(creditLedger).where(eq(creditLedger.licenseId, lic.id));
      await db.delete(licenses).where(eq(licenses.transactionId, txId));
      await db.delete(transactions).where(eq(transactions.id, txId));
    }
  });

  it("should debit atomically (no negative balance) and be idempotent per reference", async () => {
    const app = await db.query.apps.findFirst();
    if (!app) return;

    const licId = `lic_credit_${Date.now()}`;
    const licenseKey = `TT-CRE${Date.now().toString(36).toUpperCase().slice(-4)}-TEST`;
    const ctx = { licenseId: licId, appId: app.id, customerEmail: "credit_consume@tertaut.com" };

    await db.insert(licenses).values({
      id: licId,
      appId: app.id,
      licenseKey,
      customerEmail: ctx.customerEmail,
      status: "ACTIVE",
      maxSeats: 1,
    });

    try {
      await CreditService.grant(ctx, 5, { description: "seed" });

      const results = await Promise.all(
        Array.from({ length: 6 }, () => CreditService.debit(ctx, 1))
      );
      expect(results.filter((r) => r.ok).length).toBe(5);
      expect(await CreditService.getBalance(licId)).toBe(0);

      // Top up lalu uji idempotensi: reference sama tidak memotong dua kali.
      await CreditService.grant(ctx, 10, { description: "refill" });
      const reference = `job_${Date.now()}`;
      const first = await CreditService.debit(ctx, 3, { reference });
      const second = await CreditService.debit(ctx, 3, { reference });
      expect(first.ok).toBe(true);
      expect(first.ok && first.consumed).toBe(3);
      expect(second.ok).toBe(true);
      expect(second.ok && second.consumed).toBe(0);
      expect(await CreditService.getBalance(licId)).toBe(7);
    } finally {
      await db.delete(creditLedger).where(eq(creditLedger.licenseId, licId));
      await db.delete(licenses).where(eq(licenses.id, licId));
    }
  });

  it("should serve balance/consume/history over HTTP with ownership check", async () => {
    const app = await db.query.apps.findFirst();
    if (!app) return;

    const licId = `lic_credit_http_${Date.now()}`;
    const licenseKey = `TT-CHT${Date.now().toString(36).toUpperCase().slice(-4)}-TEST`;
    const hwid = `CPU_CREDIT_${Date.now()}`;
    const ctx = { licenseId: licId, appId: app.id, customerEmail: "credit_http@tertaut.com" };

    await db.insert(licenses).values({
      id: licId,
      appId: app.id,
      licenseKey,
      customerEmail: ctx.customerEmail,
      status: "ACTIVE",
      maxSeats: 2,
    });

    try {
      await CreditService.grant(ctx, 50, { description: "seed" });

      const activateRes = await fetch("http://localhost:3000/api/v1/licensing/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey, appId: app.id, hwid, deviceName: "Credit Device" }),
      });
      expect(activateRes.status).toBe(200);

      const balanceRes = await fetch("http://localhost:3000/api/v1/licensing/credits/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey, hwid }),
      });
      expect(balanceRes.status).toBe(200);
      expect((await balanceRes.json() as any).balance).toBe(50);

      // Perangkat lain tidak boleh memakai kredit lisensi ini.
      const foreignRes = await fetch("http://localhost:3000/api/v1/licensing/credits/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey, hwid: "CPU_INTRUDER", amount: 5 }),
      });
      expect(foreignRes.status).toBe(403);

      const consumeRes = await fetch("http://localhost:3000/api/v1/licensing/credits/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey, hwid, amount: 20, reason: "AI generation" }),
      });
      expect(consumeRes.status).toBe(200);
      const consumeBody: any = await consumeRes.json();
      expect(consumeBody.balance).toBe(30);
      expect(consumeBody.consumed).toBe(20);

      const overRes = await fetch("http://localhost:3000/api/v1/licensing/credits/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey, hwid, amount: 999 }),
      });
      expect(overRes.status).toBe(402);
      expect((await overRes.json() as any).balance).toBe(30);

      const historyRes = await fetch("http://localhost:3000/api/v1/licensing/credits/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey, hwid, limit: 10 }),
      });
      expect(historyRes.status).toBe(200);
      const historyBody: any = await historyRes.json();
      expect(historyBody.balance).toBe(30);
      expect(historyBody.entries.length).toBe(2);
    } finally {
      await db.delete(creditLedger).where(eq(creditLedger.licenseId, licId));
      await db.delete(licenses).where(eq(licenses.id, licId));
    }
  });

  it("P1 & P2: should support Free Trial 0-IDR checkout and License Renewal", async () => {
    const app = await db.query.apps.findFirst();
    if (!app) return;

    // Pastikan trialPeriodDays terpasang
    await db.update(apps).set({ trialPeriodDays: 14 }).where(eq(apps.id, app.id));

    const trialEmail = `trial_test_${Date.now()}@example.com`;

    // 1. Checkout trial
    const checkoutRes = await fetch("http://localhost:3000/api/v1/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: app.id,
        customerEmail: trialEmail,
        startTrial: true,
      }),
    });
    expect(checkoutRes.status).toBe(200);
    const checkoutBody: any = await checkoutRes.json();
    expect(checkoutBody.success).toBe(true);
    expect(checkoutBody.isTrial).toBe(true);
    expect(checkoutBody.trialPeriodDays).toBe(14);
    expect(checkoutBody.licenseKey).toBeDefined();

    const trialLic = await db.query.licenses.findFirst({
      where: eq(licenses.licenseKey, checkoutBody.licenseKey),
    });
    expect(trialLic).toBeDefined();
    expect(trialLic?.status).toBe("ACTIVE");
    const oldExpiresAt = new Date(trialLic!.expiresAt!).getTime();

    // 2. Renew license
    const renewRes = await fetch("http://localhost:3000/api/v1/licensing/renew", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookie,
      },
      body: JSON.stringify({
        licenseKey: checkoutBody.licenseKey,
        days: 30,
      }),
    });
    expect(renewRes.status).toBe(200);
    const renewBody: any = await renewRes.json();
    expect(renewBody.success).toBe(true);
    expect(renewBody.extendedDays).toBe(30);

    const renewedLic = await db.query.licenses.findFirst({
      where: eq(licenses.licenseKey, checkoutBody.licenseKey),
    });
    const newExpiresAt = new Date(renewedLic!.expiresAt!).getTime();
    expect(newExpiresAt).toBeGreaterThan(oldExpiresAt);

    // Cleanup
    await db.delete(transactions).where(eq(transactions.id, checkoutBody.transactionId));
    await db.delete(licenses).where(eq(licenses.id, trialLic!.id));
  });

  it("P3: should ingest metering events and debit credits from active license atomically", async () => {
    const app = await db.query.apps.findFirst();
    if (!app) return;

    // Konfigurasi metering pada aplikasi
    await db.update(apps).set({
      meteringConfig: {
        enabled: true,
        template: "api_calls",
        name: "API Call Metering",
        aggregation: "count",
        unitLabel: "API Call",
        unitPrice: 2, // 2 kredit per unit
        freeAllowance: 0,
      },
    }).where(eq(apps.id, app.id));

    const licId = `lic_meter_${Date.now()}`;
    const licenseKey = LicenseService.generateLicenseKey();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.insert(licenses).values({
      id: licId,
      appId: app.id,
      customerEmail: "metering_tester@example.com",
      licenseKey,
      status: "ACTIVE",
      expiresAt,
      maxSeats: 3,
    });

    // Berikan saldo awal 50 kredit
    await CreditService.grant(
      { licenseId: licId, appId: app.id, customerEmail: "metering_tester@example.com" },
      50,
      { description: "Initial grant for metering test" }
    );

    try {
      // 1. Ingest event pemakaian (10 unit * 2 = 20 kredit terpotong)
      const eventRes = await fetch("http://localhost:3000/api/v1/metering/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey,
          eventName: "generate_image",
          units: 10,
          idempotencyKey: `idem_${Date.now()}`,
          metadata: { model: "imagen-3" },
        }),
      });

      expect(eventRes.status).toBe(200);
      const eventBody: any = await eventRes.json();
      expect(eventBody.success).toBe(true);
      expect(eventBody.creditsDebited).toBe(20);
      expect(eventBody.remainingBalance).toBe(30);

      // 2. Cek endpoint usage
      const usageRes = await fetch(`http://localhost:3000/api/v1/metering/usage/${licenseKey}`);
      expect(usageRes.status).toBe(200);
      const usageBody: any = await usageRes.json();
      expect(usageBody.success).toBe(true);
      expect(usageBody.balance).toBe(30);
      expect(usageBody.history.length).toBeGreaterThanOrEqual(2);

      // 3. Ingest event yang melebihi saldo (20 unit * 2 = 40 kredit > 30 sisa)
      const overRes = await fetch("http://localhost:3000/api/v1/metering/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey,
          eventName: "generate_video",
          units: 20,
        }),
      });
      expect(overRes.status).toBe(402);
      const overBody: any = await overRes.json();
      expect(overBody.success).toBe(false);
      expect(overBody.currentBalance).toBe(30);
    } finally {
      await db.delete(creditLedger).where(eq(creditLedger.licenseId, licId));
      await db.delete(licenses).where(eq(licenses.id, licId));
    }
  });
});
