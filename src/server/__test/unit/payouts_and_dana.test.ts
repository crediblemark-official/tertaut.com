import { describe, it, expect, beforeEach } from "bun:test";
import { setupTestAuth } from "../setup";
import { db } from "../../db";
import { builders, apps, transactions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { generateAppApiKey, generateBuilderSecretApiKey } from "../../routes/apps/api-key";
import { DanaService } from "../../services/dana";
import { config } from "../../config";
import crypto from "crypto";

setupTestAuth();

const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

describe("Coverage: payouts router /trigger, /account & DanaService", () => {
  let builderId = "";
  let liveAppId = "";

  beforeEach(async () => {
    const email = `payout_cov_${suffix()}@test.com`;
    const [b] = await db
      .insert(builders)
      .values({
        email,
        name: "Payout Builder",
        apiKey: generateAppApiKey("live"),
        secretApiKey: generateBuilderSecretApiKey(),
        disbursementAccount: {
          bankCode: "BCA",
          accountNumber: "1234567890",
          accountHolderName: "Payout Builder",
        },
      })
      .returning();
    builderId = b.id;

    liveAppId = `app_live_${suffix()}`;
    await db.insert(apps).values({
      id: liveAppId,
      builderId,
      name: "Live App",
      slug: `live-app-${suffix()}`,
      mode: "live",
      targetPrice: 100000,
    });
  });

  it("POST /payouts/trigger: mode sandbox ditolak -> 400", async () => {
    const res = await fetch("http://localhost:3001/api/v1/payouts/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "sandbox" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /payouts/trigger: builderId tidak valid / tidak ada profil -> 404", async () => {
    const fakeUuid = crypto.randomUUID();
    const res = await fetch("http://localhost:3001/api/v1/payouts/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ builderId: fakeUuid }),
    });
    expect(res.status).toBe(404);
  });

  it("POST /payouts/trigger: saldo bersih 0 -> 400", async () => {
    const res = await fetch("http://localhost:3001/api/v1/payouts/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ builderId }),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toContain("Tidak ada saldo");
  });

  it("POST /payouts/trigger: saldo di bawah threshold Rp 50.000 -> 400", async () => {
    // Insert paid transaction Rp 30.000 net
    await db.insert(transactions).values({
      id: `tx_${suffix()}`,
      appId: liveAppId,
      builderId,
      customerEmail: `c_${suffix()}@test.com`,
      grossAmount: 30000,
      netAmount: 28500,
      platformFee: 1500,
      paymentStatus: "PAID",
      disbursementStatus: "PENDING",
      xenditExternalId: `ext_${suffix()}`,
      paymentChannel: "QRIS",
    });

    const res = await fetch("http://localhost:3001/api/v1/payouts/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ builderId }),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toContain("belum mencapai batas minimum");
  });

  it("POST /payouts/trigger: builder belum setting rekening -> 400", async () => {
    // Hapus rekening builder
    await db.update(builders).set({ disbursementAccount: null }).where(eq(builders.id, builderId));

    // Insert transaksi Rp 100.000
    await db.insert(transactions).values({
      id: `tx_${suffix()}`,
      appId: liveAppId,
      builderId,
      customerEmail: `c_${suffix()}@test.com`,
      grossAmount: 100000,
      netAmount: 95000,
      platformFee: 5000,
      paymentStatus: "PAID",
      disbursementStatus: "PENDING",
      xenditExternalId: `ext_${suffix()}`,
      paymentChannel: "QRIS",
    });

    const origSandbox = config.isSandbox;
    try {
      config.isSandbox = false;
      const res = await fetch("http://localhost:3001/api/v1/payouts/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ builderId }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toContain("belum menyimpan rekening");
    } finally {
      config.isSandbox = origSandbox;
    }
  });

  it("POST /payouts/trigger: pencairan berhasil", async () => {
    // Re-add bank account
    await db
      .update(builders)
      .set({
        disbursementAccount: {
          bankCode: "BCA",
          accountNumber: "1234567890",
          accountHolderName: "Payout Builder",
        },
      })
      .where(eq(builders.id, builderId));

    // Insert transaksi Rp 100.000
    await db.insert(transactions).values({
      id: `tx_${suffix()}`,
      appId: liveAppId,
      builderId,
      customerEmail: `c_${suffix()}@test.com`,
      grossAmount: 100000,
      netAmount: 95000,
      platformFee: 5000,
      paymentStatus: "PAID",
      disbursementStatus: "PENDING",
      xenditExternalId: `ext_${suffix()}`,
      paymentChannel: "QRIS",
    });

    const res = await fetch("http://localhost:3001/api/v1/payouts/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ builderId }),
    });
    const data = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(["COMPLETED", "PROCESSING"]).toContain(data.data.status);
  });

  it("GET & POST /payouts/account: update dan get rekening", async () => {
    const postRes = await fetch("http://localhost:3001/api/v1/payouts/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankCode: "MANDIRI",
        accountNumber: "987654321",
        accountHolderName: "Updated Name",
      }),
    });
    expect(postRes.status).toBe(200);

    const getRes = await fetch("http://localhost:3001/api/v1/payouts/account");
    expect(getRes.status).toBe(200);
    const data = (await getRes.json()) as any;
    expect(data.success).toBe(true);
  });
});

describe("Coverage: DanaService verifyWebhook & createDisbursement", () => {
  it("verifyWebhook: verifikasi tanda tangan RSA", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const originalKey = config.dana.publicKey;
    try {
      config.dana.publicKey = publicKey;
      const body = { partnerReferenceNo: "12345", amount: { value: "10000.00" } };
      const rawString = JSON.stringify(body);
      const signer = crypto.createSign("SHA256");
      signer.update(rawString);
      const signature = signer.sign(privateKey, "base64");

      const valid = DanaService.verifyWebhook({ "x-signature": signature }, body);
      expect(valid).toBe(true);

      const invalid = DanaService.verifyWebhook({ "x-signature": "invalid_sig" }, body);
      expect(invalid).toBe(false);
    } finally {
      config.dana.publicKey = originalKey;
    }
  });

  it("createDisbursement: mock mode sandbox", async () => {
    const origClient = config.dana.clientId;
    try {
      config.dana.clientId = "";
      const disb = await DanaService.createDisbursement({
        externalId: `dana_${suffix()}`,
        amount: 50000,
        bankCode: "BCA",
        accountHolderName: "John Doe",
        accountNumber: "12345678",
        description: "Payout test",
      });
      expect(disb.status).toBe("COMPLETED");
      expect(disb.amount).toBe(50000);
    } finally {
      config.dana.clientId = origClient;
    }
  });
});
