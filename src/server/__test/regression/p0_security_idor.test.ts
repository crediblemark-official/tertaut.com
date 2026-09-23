import { describe, it, expect, beforeAll } from "bun:test";
import { app } from "../../index";
import { auth } from "../../auth";
import { db } from "../../db";
import { apps, builders, licenses, coupons } from "../../db/schema";
import { eq } from "drizzle-orm";
import { generateAppApiKey, generateBuilderSecretApiKey } from "../../routes/apps/api-key";
import { LicenseService } from "../../services/license";
import { createPollTicket } from "../../utils/pollTicket";

describe("P0 Security & IDOR Regression Tests", () => {
  let cookieA = "";
  let cookieB = "";
  let builderA: any;
  let builderB: any;
  let appA: any;
  let licenseA: any;
  let couponA: any;

  beforeAll(async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const emailA = `builderA_${suffix}@tertaut-test.com`;
    const emailB = `builderB_${suffix}@tertaut-test.com`;
    const password = "TestPassword123!";

    // 1. Sign up User A
    const resA = await auth.api.signUpEmail({
      body: { email: emailA, password, name: "Builder A" },
      asResponse: true,
    });
    const rawCookieA = resA.headers.get("set-cookie") || "";
    cookieA = rawCookieA.split(";")[0];
    const dataA = await resA.json();

    // 2. Sign up User B
    const resB = await auth.api.signUpEmail({
      body: { email: emailB, password, name: "Builder B" },
      asResponse: true,
    });
    const rawCookieB = resB.headers.get("set-cookie") || "";
    cookieB = rawCookieB.split(";")[0];
    const dataB = await resB.json();

    // Pastikan profil builder ada di database
    [builderA] = await db
      .insert(builders)
      .values({
        userId: dataA.user.id,
        email: emailA,
        name: "Builder A",
        apiKey: generateAppApiKey("sandbox"),
        secretApiKey: generateBuilderSecretApiKey(),
      })
      .returning();

    [builderB] = await db
      .insert(builders)
      .values({
        userId: dataB.user.id,
        email: emailB,
        name: "Builder B",
        apiKey: generateAppApiKey("sandbox"),
        secretApiKey: generateBuilderSecretApiKey(),
      })
      .returning();

    // App milik Builder A
    [appA] = await db
      .insert(apps)
      .values({
        id: `app_p0_a_${suffix}`,
        name: "App Milik A",
        slug: `app-p0-a-${suffix}`,
        builderId: builderA.id,
        targetPrice: 75000,
        mode: "sandbox",
      })
      .returning();

    // Lisensi milik App A
    const licRes = await LicenseService.issueDirect({
      appId: appA.id,
      customerEmail: "custA@domain.com",
      grantDays: 30,
      maxSeats: 3,
      actor: { type: "BUILDER", id: builderA.id },
    });
    licenseA = licRes.license;

    // Kupon milik App A
    [couponA] = await db
      .insert(coupons)
      .values({
        id: `cpn_p0_a_${suffix}`,
        code: `DISC_${suffix.toUpperCase()}`,
        appId: appA.id,
        discountPercent: 20,
        isActive: true,
      })
      .returning();
  });

  it("IDOR-1: Builder B TIDAK boleh menerbitkan lisensi untuk App milik Builder A (403)", async () => {
    const res = await app.handle(
      new Request("http://localhost:8081/api/v1/licensing/issue", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookieB,
        },
        body: JSON.stringify({
          appId: appA.id,
          customerEmail: "attacker@domain.com",
          grantDays: 365,
        }),
      })
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Forbidden");
  });

  it("IDOR-2: Builder B TIDAK boleh me-revoke lisensi milik Builder A (403)", async () => {
    const res = await app.handle(
      new Request("http://localhost:8081/api/v1/licensing/revoke", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookieB,
        },
        body: JSON.stringify({
          licenseKey: licenseA.licenseKey,
        }),
      })
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Forbidden");
  });

  it("IDOR-3: Builder B TIDAK boleh unbind-hardware lisensi milik Builder A (403)", async () => {
    const res = await app.handle(
      new Request("http://localhost:8081/api/v1/licensing/unbind-hardware", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookieB,
        },
        body: JSON.stringify({
          licenseKey: licenseA.licenseKey,
        }),
      })
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Forbidden");
  });

  it("IDOR-3: Builder B TIDAK boleh membaca seats/HWID lisensi milik Builder A (403)", async () => {
    const res = await app.handle(
      new Request(
        `http://localhost:8081/api/v1/licensing/seats?licenseKey=${licenseA.licenseKey}`,
        {
          method: "GET",
          headers: {
            cookie: cookieB,
          },
        }
      )
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Forbidden");
  });

  it("IDOR-4: Builder B TIDAK boleh menyimpan/mengakses kredensial AI Vault milik App A (403)", async () => {
    const res = await app.handle(
      new Request("http://localhost:8081/api/v1/ai-proxy/vault", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookieB,
        },
        body: JSON.stringify({
          appId: appA.id,
          provider: "openai",
          rawApiKey: "sk-proj-stolen-key",
        }),
      })
    );

    expect(res.status).toBe(403);
  });

  it("IDOR-5: Builder B TIDAK boleh membuat atau menghapus kupon untuk App A (403)", async () => {
    // Coba create kupon
    const createRes = await app.handle(
      new Request("http://localhost:8081/api/v1/coupons", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookieB,
        },
        body: JSON.stringify({
          appId: appA.id,
          code: "EVIL100",
          discountPercent: 100,
        }),
      })
    );
    expect(createRes.status).toBe(403);

    // Coba delete kupon milik App A
    const deleteRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/coupons/${couponA.id}`, {
        method: "DELETE",
        headers: {
          cookie: cookieB,
        },
      })
    );
    expect(deleteRes.status).toBe(403);
  });

  it("IDOR-6: Builder B TIDAK boleh mengubah status Live app milik Builder A (400 / Forbidden)", async () => {
    const res = await app.handle(
      new Request("http://localhost:8081/api/v1/launch/convert-to-live", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookieB,
        },
        body: JSON.stringify({
          campaignId: appA.id,
        }),
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message || body.error).toContain("Forbidden");
  });

  it("P0.3: Finish checkout redirect dan response TIDAK membocorkan licenseKey polos", async () => {
    const externalId = `ext_test_${Date.now()}`;
    const [insertedTx] = await db
      .insert(require("../../db/schema").transactions)
      .values({
        id: `tx_${Date.now()}`,
        appId: appA.id,
        builderId: builderA.id,
        xenditExternalId: externalId,
        grossAmount: 50000,
        platformFee: 2500,
        netAmount: 47500,
        paymentStatus: "PAID",
        customerEmail: "buyer@domain.com",
      })
      .returning();

    // Hubungkan lisensi ke transaksi
    await db
      .update(licenses)
      .set({ transactionId: insertedTx.id })
      .where(eq(licenses.id, licenseA.id));

    // Panggil finish tanpa ticket
    const finishRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/checkout/dana/finish?externalId=${externalId}`, {
        headers: {
          accept: "application/json",
        },
      })
    );

    expect(finishRes.status).toBe(200);
    const finishJson = await finishRes.json();
    // licenseKey wajib null bila tanpa valid ticket
    expect(finishJson.licenseKey).toBeNull();
    // redirectUrl tidak boleh menyertakan licenseKey=TT-
    expect(finishJson.redirectUrl).not.toContain(`licenseKey=${licenseA.licenseKey}`);
    expect(finishJson.redirectUrl).toContain("ticket=");

    // Panggil finish dengan ticket valid
    const validTicket = createPollTicket(insertedTx.id);
    const finishWithTicketRes = await app.handle(
      new Request(
        `http://localhost:8081/api/v1/checkout/dana/finish?externalId=${externalId}&ticket=${validTicket}`,
        {
          headers: {
            accept: "application/json",
          },
        }
      )
    );
    const finishTicketJson = await finishWithTicketRes.json();
    expect(finishTicketJson.licenseKey).toBe(licenseA.licenseKey);
  });
});
