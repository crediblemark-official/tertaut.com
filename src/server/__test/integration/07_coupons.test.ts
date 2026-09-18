import { describe, it, expect } from "bun:test";
import { setupTestAuth } from "../setup";
import { db } from "../../db";
import { apps, coupons, transactions } from "../../db/schema";
import { eq } from "drizzle-orm";

setupTestAuth();

describe("PRD Module 1.5: Discount Coupon Redemption (E2E via API)", () => {
  async function createTestApp(): Promise<{ id: string; slug: string }> {
    const builder = await db.query.builders.findFirst();
    if (!builder) throw new Error("No builder found — jalankan seed/auto-seed dulu");

    const testAppId = `app_coupon_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const testSlug = `coupon-test-${Math.random().toString(36).substring(2, 8)}`;

    await db.insert(apps).values({
      id: testAppId,
      builderId: builder.id,
      name: "Coupon E2E Test App",
      slug: testSlug,
      mode: "live",
      targetPrice: 100000,
    });

    return { id: testAppId, slug: testSlug };
  }

  it("should create coupon via API, preview discount, and redeem it on checkout session", async () => {
    const testApp = await createTestApp();
    const testCode = `E2E${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    try {
      // 1. Buat kupon via API manajemen
      const createRes = await fetch("http://localhost:3000/api/v1/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          code: testCode,
          discountPercent: 25,
          maxRedemptions: 5,
        }),
      });
      const createData: any = await createRes.json();
      expect(createRes.status).toBe(200);
      expect(createData.success).toBe(true);
      expect(createData.coupon.code).toBe(testCode);
      expect(createData.coupon.discountPercent).toBe(25);
      expect(createData.coupon.redemptionCount).toBe(0);
      const couponId = createData.coupon.id as string;

      // 2. Preview diskon TANPA membuat transaksi
      const previewRes = await fetch("http://localhost:3000/api/v1/checkout/preview-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: testApp.id, couponCode: testCode, amount: 100000 }),
      });
      const previewData: any = await previewRes.json();
      expect(previewRes.status).toBe(200);
      expect(previewData.valid).toBe(true);
      expect(previewData.discountPercent).toBe(25);
      expect(previewData.discountAmount).toBe(25000);
      expect(previewData.payableAmount).toBe(75000);

      // 3. Tebus kupon via checkout session sungguhan (invoice mock di sandbox)
      const checkoutRes = await fetch("http://localhost:3000/api/v1/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          amount: 100000,
          customerEmail: `coupon_e2e_${Date.now()}@test.local`,
          couponCode: testCode,
        }),
      });
      const checkoutData: any = await checkoutRes.json();
      expect(checkoutRes.status).toBe(200);
      expect(checkoutData.success).toBe(true);
      expect(checkoutData.couponCode).toBe(testCode);
      expect(checkoutData.discountAmount).toBe(25000);
      // Nominal yang ditagihkan Xendit = harga list - diskon
      expect(checkoutData.amount).toBe(75000);

      // 4. Transaksi di DB mencatat kupon & breakdown MoR atas nominal terdiskon
      const txId = checkoutData.transactionId as string;
      const tx = await db.query.transactions.findFirst({ where: eq(transactions.id, txId) });
      expect(tx).toBeDefined();
      expect(tx!.couponCode).toBe(testCode);
      expect(tx!.discountAmount).toBe(25000);
      expect(tx!.grossAmount).toBe(75000);
      // 5% dari 75000 = 3750; net 95% = 71250
      expect(tx!.platformFee).toBe(3750);
      expect(tx!.netAmount).toBe(71250);

      // 5. Kuota penebusan naik tepat 1
      const redeemed = await db.query.coupons.findFirst({ where: eq(coupons.id, couponId) });
      expect(redeemed).toBeDefined();
      expect(redeemed!.redemptionCount).toBe(1);

      // Cleanup transaksi tes
      await db.delete(transactions).where(eq(transactions.id, txId));
    } finally {
      await db.delete(coupons).where(eq(coupons.appId, testApp.id));
      await db.delete(apps).where(eq(apps.id, testApp.id));
    }
  }, 15000);

  it("should reject unknown coupon codes and app-mismatched coupons at checkout", async () => {
    const testApp = await createTestApp();
    const otherApp = await createTestApp();

    try {
      // 1. Kode yang tidak ada sama sekali
      const unknownRes = await fetch("http://localhost:3000/api/v1/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          amount: 100000,
          customerEmail: `coupon_unknown_${Date.now()}@test.local`,
          couponCode: "NO_SUCH_COUPON_XYZ",
        }),
      });
      const unknownData: any = await unknownRes.json();
      expect(unknownRes.status).toBe(400);
      expect(unknownData.errorCode).toBe("COUPON_NOT_FOUND");

      // 2. Kupon valid milik app lain tidak boleh dipakai lintas app
      const createRes = await fetch("http://localhost:3000/api/v1/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: otherApp.id,
          code: `OWN${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          discountPercent: 10,
        }),
      });
      const created: any = await createRes.json();
      expect(createRes.status).toBe(200);

      const mismatchRes = await fetch("http://localhost:3000/api/v1/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          amount: 100000,
          customerEmail: `coupon_mismatch_${Date.now()}@test.local`,
          couponCode: created.coupon.code,
        }),
      });
      const mismatchData: any = await mismatchRes.json();
      expect(mismatchRes.status).toBe(400);
      expect(mismatchData.errorCode).toBe("COUPON_NOT_FOUND");
    } finally {
      await db.delete(coupons).where(eq(coupons.appId, otherApp.id));
      await db.delete(apps).where(eq(apps.id, otherApp.id));
      await db.delete(apps).where(eq(apps.id, testApp.id));
    }
  });

  it("should enforce maxRedemptions quota (second redemption rejected, no ghost invoice)", async () => {
    const testApp = await createTestApp();
    const testCode = `QTA${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    try {
      // Kupon dengan kuota 1x
      const createRes = await fetch("http://localhost:3000/api/v1/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          code: testCode,
          discountPercent: 50,
          maxRedemptions: 1,
        }),
      });
      expect(createRes.status).toBe(200);

      // Penebusan #1: sukses
      const res1 = await fetch("http://localhost:3000/api/v1/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          amount: 100000,
          customerEmail: `coupon_quota1_${Date.now()}@test.local`,
          couponCode: testCode,
        }),
      });
      const data1: any = await res1.json();
      expect(res1.status).toBe(200);
      expect(data1.success).toBe(true);
      expect(data1.amount).toBe(50000);

      // Penebusan #2: ditolak karena kuota habis
      const res2 = await fetch("http://localhost:3000/api/v1/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          amount: 100000,
          customerEmail: `coupon_quota2_${Date.now()}@test.local`,
          couponCode: testCode,
        }),
      });
      const data2: any = await res2.json();
      expect(res2.status).toBe(400);
      expect(data2.errorCode).toBe("COUPON_EXHAUSTED");

      // Transaksi dengan kupon ini harus TEPAT 1 (tidak ada invoice hantu terdiskon)
      const txsWithCoupon = await db.query.transactions.findMany({
        where: eq(transactions.couponCode, testCode),
      });
      expect(txsWithCoupon.length).toBe(1);
      expect(txsWithCoupon[0].customerEmail).toContain("coupon_quota1_");

      // Cleanup transaksi penebusan pertama
      await db.delete(transactions).where(eq(transactions.id, data1.transactionId));
    } finally {
      await db.delete(coupons).where(eq(coupons.appId, testApp.id));
      await db.delete(apps).where(eq(apps.id, testApp.id));
    }
  });

  it("should toggle coupon active state via API and block redemption while inactive", async () => {
    const testApp = await createTestApp();
    const testCode = `TOG${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    try {
      const createRes = await fetch("http://localhost:3000/api/v1/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          code: testCode,
          discountPercent: 20,
        }),
      });
      const created: any = await createRes.json();
      expect(createRes.status).toBe(200);
      const couponId = created.coupon.id as string;

      // Nonaktifkan via PATCH
      const patchRes = await fetch(`http://localhost:3000/api/v1/coupons/${couponId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      const patchData: any = await patchRes.json();
      expect(patchRes.status).toBe(200);
      expect(patchData.coupon.isActive).toBe(false);

      // Penebusan saat nonaktif harus ditolak
      const redeemRes = await fetch("http://localhost:3000/api/v1/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          amount: 100000,
          customerEmail: `coupon_inactive_${Date.now()}@test.local`,
          couponCode: testCode,
        }),
      });
      const redeemData: any = await redeemRes.json();
      expect(redeemRes.status).toBe(400);
      expect(redeemData.errorCode).toBe("COUPON_INACTIVE");

      // Aktifkan kembali → preview valid lagi
      await fetch(`http://localhost:3000/api/v1/coupons/${couponId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });

      const previewRes = await fetch("http://localhost:3000/api/v1/checkout/preview-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: testApp.id, couponCode: testCode, amount: 100000 }),
      });
      const previewData: any = await previewRes.json();
      expect(previewRes.status).toBe(200);
      expect(previewData.valid).toBe(true);
      expect(previewData.discountAmount).toBe(20000);
    } finally {
      await db.delete(coupons).where(eq(coupons.appId, testApp.id));
      await db.delete(apps).where(eq(apps.id, testApp.id));
    }
  });
});
