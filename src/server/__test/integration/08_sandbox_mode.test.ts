import { describe, it, expect } from "bun:test";
import { setupTestAuth } from "../setup";
import { db } from "../../db";
import { apps, licenses, transactions } from "../../db/schema";
import { eq } from "drizzle-orm";

setupTestAuth();

async function createSandboxTestApp(): Promise<{ id: string; slug: string }> {
  const builder = await db.query.builders.findFirst();
  if (!builder) throw new Error("No builder found — jalankan seed/auto-seed dulu");

  const testAppId = `app_sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
  const testSlug = `sandbox-test-${Math.random().toString(36).substring(2, 8)}`;

  await db.insert(apps).values({
    id: testAppId,
    builderId: builder.id,
    name: "Sandbox E2E Test App",
    slug: testSlug,
    mode: "sandbox",
    targetPrice: 50000,
  });

  return { id: testAppId, slug: testSlug };
}

describe("Sandbox & Live App Mode (creem.io-style)", () => {
  it("should create app with sandbox mode by default and allow mode toggle to live", async () => {
    const builder = await db.query.builders.findFirst();
    if (!builder) return;

    const testSlug = `mode-test-${Math.random().toString(36).substring(2, 8)}`;
    let createdAppId: string | null = null;

    try {
      // App baru dibuat TANPA mode eksplisit → default sandbox (seperti creem.io)
      const createRes = await fetch("http://localhost:3001/api/v1/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Default Sandbox App",
          slug: testSlug,
          targetPrice: 25000,
        }),
      });
      const created: any = await createRes.json();
      expect(createRes.status).toBe(200);
      expect(created.app.mode).toBe("sandbox");
      createdAppId = created.app.id;

      // Toggle ke live
      const toggleRes = await fetch(`http://localhost:3001/api/v1/apps/${createdAppId}/mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "live" }),
      });
      const toggled: any = await toggleRes.json();
      expect(toggleRes.status).toBe(200);
      expect(toggled.app.mode).toBe("live");
    } finally {
      if (createdAppId) await db.delete(apps).where(eq(apps.id, createdAppId));
    }
  });

  it("should create product with subscription pricing, multi-delivery config, and usage-based metering", async () => {
    const builder = await db.query.builders.findFirst();
    if (!builder) return;

    const testSlug = `creem-prod-${Math.random().toString(36).substring(2, 8)}`;
    let createdAppId: string | null = null;

    try {
      const createRes = await fetch("http://localhost:3001/api/v1/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "AI Code Companion Pro",
          slug: testSlug,
          targetPrice: 99000,
          pricingType: "subscription",
          billingPeriod: "monthly",
          deliveryConfig: {
            licenseKey: {
              enabled: true,
              description: "Pro Developer License",
              expiresInDays: 30,
              maxSeats: 3,
            },
            fileDownload: {
              enabled: true,
              title: "VS Code Extension Pack",
              fileUrl: "https://cdn.example.com/pack.zip",
            },
            privateNote: {
              enabled: true,
              title: "Access Discord",
              note: "Private invite link and activation secret",
            },
          },
          meteringConfig: {
            enabled: true,
            template: "llm_tokens",
            name: "Token LLM",
            aggregation: "sum(tokens) on ai_usage",
            unitPrice: 15,
            metricUnit: "per 1.000 token",
          },
        }),
      });

      const json: any = await createRes.json();
      expect(createRes.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.app.pricingType).toBe("subscription");
      expect(json.app.billingPeriod).toBe("monthly");
      expect(json.app.deliveryConfig.licenseKey.enabled).toBe(true);
      expect(json.app.deliveryConfig.fileDownload.enabled).toBe(true);
      expect(json.app.deliveryConfig.privateNote.enabled).toBe(true);
      expect(json.app.meteringConfig.enabled).toBe(true);
      expect(json.app.meteringConfig.template).toBe("llm_tokens");
      expect(json.app.meteringConfig.aggregation).toBe("sum(tokens) on ai_usage");
      createdAppId = json.app.id;

      // Update via PATCH
      const patchRes = await fetch(`http://localhost:3001/api/v1/apps/${createdAppId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricingType: "one_time",
          billingPeriod: null,
          meteringConfig: {
            enabled: true,
            template: "api_calls",
            name: "Permintaan API",
            aggregation: "count on api_call",
            unitPrice: 5,
            metricUnit: "per panggilan",
          },
        }),
      });

      const patchJson: any = await patchRes.json();
      expect(patchRes.status).toBe(200);
      expect(patchJson.app.pricingType).toBe("one_time");
      expect(patchJson.app.meteringConfig.template).toBe("api_calls");
    } finally {
      if (createdAppId) await db.delete(apps).where(eq(apps.id, createdAppId));
    }
  });

  it("should mark checkout session as sandbox and simulate payment to issue license", async () => {
    const testApp = await createSandboxTestApp();

    try {
      // 1. Buat sesi checkout → invoice mock karena app mode sandbox
      const sessionRes = await fetch("http://localhost:3001/api/v1/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          amount: 50000,
          customerEmail: `sandbox_${Date.now()}@test.local`,
        }),
      });
      const sessionData: any = await sessionRes.json();
      expect(sessionRes.status).toBe(200);
      expect(sessionData.success).toBe(true);
      expect(sessionData.data.isSandbox).toBe(true);
      expect(sessionData.data.xenditInvoiceUrl).toContain("mock");

      const txId = sessionData.data.sessionId;

      // 2. Simulasikan pembayaran
      const simRes = await fetch(`http://localhost:3001/api/v1/checkout/simulate-paid/${txId}`, {
        method: "POST",
      });
      const simData: any = await simRes.json();
      expect(simRes.status).toBe(200);
      expect(simData.success).toBe(true);
      expect(simData.licenseKey).toMatch(/^TT-/);

      // 3. Transaksi berstatus PAID
      const tx = await db.query.transactions.findFirst({ where: eq(transactions.id, txId) });
      expect(tx?.paymentStatus).toBe("PAID");

      // 4. Pencairan harus DITOLAK untuk transaksi sandbox
      const disbRes = await fetch(`http://localhost:3001/api/v1/checkout/disburse/${txId}`, {
        method: "POST",
      });
      expect(disbRes.status).toBe(400);

      // 5. Simulate-paid untuk app yang sudah LIVE harus selalu ditolak (403) demi keamanan (B5)
      await db.update(apps).set({ mode: "live" }).where(eq(apps.id, testApp.id));
      const simLiveRes = await fetch(`http://localhost:3001/api/v1/checkout/simulate-paid/${txId}`, {
        method: "POST",
      });
      expect(simLiveRes.status).toBe(403);
    } finally {
      await db.delete(licenses).where(eq(licenses.appId, testApp.id));
      await db.delete(transactions).where(eq(transactions.appId, testApp.id));
      await db.delete(apps).where(eq(apps.id, testApp.id));
    }
  });
});
