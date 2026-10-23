import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";
import { db } from "../../db";
import { apps, builders, platformSettings } from "../../db/schema";
import { eq, inArray } from "drizzle-orm";
import { setupTestAuth, authCookie } from "../setup";
import {
  GATEWAY_IDS,
  normalizeGatewayId,
  getPaymentGateway,
} from "../../services/payments/gateways";
import { handleGetPlatformSettings } from "../../routes/panel/settings";
setupTestAuth();
const suffix = crypto.randomUUID();
let builderId: string;
const appId = `xendit_only_${suffix}`;
const retiredKeys = ["dana_sandbox_client_id", "xenithpay_sandbox_access_key"];
describe("Xendit-only gateway retirement", () => {
  beforeAll(async () => {
    const [builder] = await db
      .insert(builders)
      .values({ name: "Xendit", email: `${suffix}@example.invalid`, apiKey: suffix })
      .returning();
    builderId = builder.id;
    await db.insert(apps).values({
      id: appId,
      slug: appId,
      builderId,
      name: "Xendit",
      mode: "live",
      targetPrice: 100000,
    });
  });
  afterAll(async () => {
    await db.delete(builders).where(eq(builders.id, builderId));
    await db.delete(platformSettings).where(inArray(platformSettings.key, retiredKeys));
  });
  test("registry exposes Xendit and the simulator and rejects retired provider lookups", () => {
    expect(GATEWAY_IDS).toEqual(["xendit", "sandbox"]);
    for (const provider of ["dana", "xenith", "xenithpay"]) {
      expect(normalizeGatewayId(provider)).toBeNull();
      expect(() => getPaymentGateway(provider)).toThrow("tidak lagi didukung");
    }
  });
  test("retired checkout provider requests fail before creating an invoice", async () => {
    for (const paymentGateway of ["dana", "xenithpay"]) {
      const response = await app.handle(
        new Request("http://localhost:8081/api/v1/checkout/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appId, customerEmail: "buyer@example.invalid", paymentGateway }),
        })
      );
      expect(response.status).toBe(400);
      expect((await response.json()).success).toBe(false);
    }
  });
  test("retired callbacks and finish endpoints are no longer mounted", async () => {
    for (const path of [
      "/api/v1/webhook/dana/notify",
      "/api/v1/webhooks/dana/finish-payment",
      "/api/v1/webhook/xenithpay",
      "/api/v1/webhook/xenithpay/payout",
      "/v1.0/debit/notify",
      "/v1.0/emoney/transfer-bank-notify.htm",
    ]) {
      const response = await app.handle(
        new Request(`http://localhost:8081${path}`, {
          method: "POST",
          headers: { Cookie: authCookie, "Content-Type": "application/json" },
          body: "{}",
        })
      );
      expect(response.status).toBe(404);
    }
    const response = await app.handle(
      new Request("http://localhost:8081/api/v1/checkout/dana/finish", {
        headers: { Cookie: authCookie },
      })
    );
    expect(response.status).toBe(404);
  });
  test("old provider settings are hidden and cannot be saved again", async () => {
    await db
      .insert(platformSettings)
      .values(retiredKeys.map((key) => ({ key, value: "retired-test-value" })))
      .onConflictDoNothing();
    const result = await handleGetPlatformSettings();
    for (const key of retiredKeys) {
      expect(result.settings[key]).toBeUndefined();
      expect(result.items.some((row) => row.key === key)).toBe(false);
    }
    const response = await app.handle(
      new Request("http://localhost:8081/api/v1/panel/settings", {
        method: "PATCH",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { dana_sandbox_client_id: "retired" } }),
      })
    );
    expect(response.status).toBe(400);
  });
});
