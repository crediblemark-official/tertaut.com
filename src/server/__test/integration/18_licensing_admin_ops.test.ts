import { describe, it, expect, beforeAll } from "bun:test";
import { setupTestAuth } from "../setup";
import {
  handleListLicenses,
  handleIssueLicense,
  handleRevokeLicense,
  handleVerifyApiKey,
  handleListEvents,
  handleRenewLicense,
} from "../../routes/licensing/admin";
import {
  handleListWebhooks,
  handleCreateWebhook,
  handleUpdateWebhook,
  handleDeleteWebhook,
  handleRotateWebhookSecret,
  handleTestWebhook,
} from "../../routes/licensing/adminWebhooks";
import { db } from "../../db";
import { apps, builders, licenses, webhookEndpoints } from "../../db/schema";
import { eq } from "drizzle-orm";
import { generateAppApiKey } from "../../routes/apps/api-key";

setupTestAuth();

describe("Licensing Admin Routes & Operations", () => {
  let testApp: any;
  let testBuilder: any;
  let adminHeaders: Headers;

  beforeAll(async () => {
    const { authCookie } = await import("../setup");
    adminHeaders = new Headers({ cookie: authCookie });
    testApp = await db.query.apps.findFirst();
    if (!testApp) {
      const [b] = await db
        .insert(builders)
        .values({
          name: "Admin Test Builder",
          email: `adm_${Date.now()}@test.com`,
          apiKey: generateAppApiKey("live"),
        })
        .returning();
      const [a] = await db
        .insert(apps)
        .values({
          id: `app_adm_${Date.now()}`,
          name: "Admin Test App",
          slug: `adm-${Date.now()}`,
          builderId: b.id,
          targetPrice: 50000,
        })
        .returning();
      testApp = a;
      testBuilder = b;
    } else {
      testBuilder = await db.query.builders.findFirst({
        where: eq(builders.id, testApp.builderId),
      });
    }
  });

  it("should issue, list, verify api-key, renew, and revoke a license", async () => {
    // 1. Issue License
    const issueRes = await handleIssueLicense({
      body: {
        appId: testApp.id,
        customerEmail: "admin_tester@tertaut.com",
        grantDays: 14,
        maxSeats: 3,
        platform: "desktop",
        grantCredits: 250,
        features: { pro_export: true, cloud_sync: true },
      },
    });

    expect(issueRes.success).toBe(true);
    expect(issueRes.license).toBeDefined();
    expect(issueRes.license!.appId).toBe(testApp.id);
    expect(issueRes.creditBalance).toBe(250);

    const issuedKey = issueRes.license!.licenseKey;
    const issuedApiKey = issueRes.license!.apiKey;

    // 2. List Licenses (with appId, mode, limit, offset, page)
    const listRes = await handleListLicenses({
      query: { appId: testApp.id, limit: 10, offset: 0, page: 1 },
    });
    expect(listRes.success).toBe(true);
    expect(Array.isArray(listRes.licenses)).toBe(true);
    const found = listRes.licenses.find((l: any) => l.licenseKey === issuedKey);
    expect(found).toBeDefined();

    // 3. Verify API Key
    const set: any = {};
    const testApiKey = `tt_cust_${Date.now()}`;
    await db
      .update(licenses)
      .set({ apiKey: testApiKey })
      .where(eq(licenses.id, issueRes.license!.id));

    const verifyMissing = await handleVerifyApiKey({ body: {}, set });
    expect(set.status).toBe(400);
    expect(verifyMissing.valid).toBe(false);

    const verifyNotFound = await handleVerifyApiKey({
      body: { apiKey: "invalid_key_xyz" },
      set: {},
    });
    expect(verifyNotFound.valid).toBe(false);

    const verifySuccess = await handleVerifyApiKey({ body: { apiKey: testApiKey }, set: {} });
    expect(verifySuccess.valid).toBe(true);
    expect(verifySuccess.customerEmail).toBe("admin_tester@tertaut.com");
    expect(verifySuccess.credits).toBe(250);

    // 4. Renew License
    const renewMissing = await handleRenewLicense({ body: {}, set: {} });
    expect(renewMissing.success).toBe(false);

    const renewNotFound = await handleRenewLicense({
      body: { licenseKey: "TT-NONEXISTENT-9999" },
      set: {},
    });
    expect(renewNotFound.success).toBe(false);

    const renewSuccess = await handleRenewLicense({
      body: { licenseKey: issuedKey, additionalDays: 30 },
      request: { headers: adminHeaders },
      set: {},
    });
    expect(renewSuccess.success).toBe(true);
    expect(renewSuccess.extendedDays).toBe(30);

    // Renew with default app billing period fallback (additionalDays undefined)
    const renewDefault = await handleRenewLicense({
      body: { licenseKey: issuedKey },
      request: { headers: adminHeaders },
      set: {},
    });
    expect(renewDefault.success).toBe(true);
    expect(renewDefault.extendedDays).toBeGreaterThan(0);

    // 5. List Events
    const eventsRes = await handleListEvents({
      query: { appId: testApp.id, limit: 10, offset: 0 },
      set: {},
    });
    expect(eventsRes.success).toBe(true);
    expect(Array.isArray(eventsRes.events)).toBe(true);

    // 6. Revoke License
    const revokeNotFound = await handleRevokeLicense({
      body: { licenseKey: "TT-NOT-FOUND-0000" },
      set,
    });
    expect(set.status).toBe(404);

    const revokeSuccess: any = await handleRevokeLicense({
      body: { licenseKey: issuedKey },
      set: {},
    });
    expect(revokeSuccess.success).toBe(true);
    expect(revokeSuccess.license?.status).toBe("REVOKED");
  });

  it("should perform full webhook endpoint lifecycle (create, list, update, rotate, test, delete)", async () => {
    const set: any = {};
    const { authCookie } = await import("../setup");
    const adminHeaders = new Headers({ cookie: authCookie });

    // 1. Create Webhook validations
    const invalidUrl = await handleCreateWebhook({
      body: { builderId: testBuilder?.id, url: "ftp://invalid-url" },
      request: { headers: adminHeaders },
      set,
    });
    expect(set.status).toBe(400);

    const invalidEvents = await handleCreateWebhook({
      body: {
        builderId: testBuilder?.id,
        url: "https://hook.example.com/webhook",
        events: ["invalid.event"],
      },
      request: { headers: adminHeaders },
      set,
    });
    expect(set.status).toBe(400);

    // Valid create
    const createRes: any = await handleCreateWebhook({
      body: {
        builderId: testBuilder?.id,
        url: "https://hook.example.com/webhook",
        events: ["license.issued", "license.renewed"],
        isActive: true,
      },
      request: { headers: adminHeaders },
      set: {},
    });
    expect(createRes.success).toBe(true);
    const hookId = createRes.webhook?.id;

    // 2. List Webhooks
    const listRes: any = await handleListWebhooks({ request: { headers: adminHeaders }, set: {} });
    expect(listRes.success).toBe(true);
    expect(Array.isArray(listRes.webhooks)).toBe(true);
    const foundHook = listRes.webhooks?.find((w: any) => w.id === hookId);
    expect(foundHook).toBeDefined();

    // 3. Update Webhook
    const updateNotFound = await handleUpdateWebhook({
      params: { id: "non_existent_hook" },
      body: {},
      request: { headers: adminHeaders },
      set,
    });
    expect(set.status).toBe(404);

    const updateInvalidEvents = await handleUpdateWebhook({
      params: { id: hookId },
      body: { events: ["fake.event"] },
      request: { headers: adminHeaders },
      set,
    });
    expect(set.status).toBe(400);

    const updateRes: any = await handleUpdateWebhook({
      params: { id: hookId },
      body: { url: "https://hook.example.com/updated", isActive: false },
      request: { headers: adminHeaders },
      set: {},
    });
    expect(updateRes.success).toBe(true);
    expect(updateRes.webhook?.url).toBe("https://hook.example.com/updated");
    expect(updateRes.webhook?.isActive).toBe(false);

    // 4. Rotate Secret
    const rotateNotFound = await handleRotateWebhookSecret({
      params: { id: "non_existent_hook" },
      request: { headers: adminHeaders },
      set,
    });
    expect(set.status).toBe(404);

    const rotateRes: any = await handleRotateWebhookSecret({
      params: { id: hookId },
      request: { headers: adminHeaders },
      set: {},
    });
    expect(rotateRes.success).toBe(true);
    expect(rotateRes.webhook?.secret).not.toBe(createRes.webhook?.secret);

    // 5. Test Webhook Delivery
    const testNotFound = await handleTestWebhook({
      params: { id: "non_existent_hook" },
      request: { headers: adminHeaders },
      set,
    });
    expect(set.status).toBe(404);

    const testRes = await handleTestWebhook({
      params: { id: hookId },
      request: { headers: adminHeaders },
      set: {},
    });
    expect(testRes.success).toBe(true);
    expect(testRes.deliveryId).toBeDefined();

    // 6. Delete Webhook
    const deleteNotFound = await handleDeleteWebhook({
      params: { id: "non_existent_hook" },
      request: { headers: adminHeaders },
      set,
    });
    expect(set.status).toBe(404);

    const deleteRes = await handleDeleteWebhook({
      params: { id: hookId },
      request: { headers: adminHeaders },
      set: {},
    });
    expect(deleteRes.success).toBe(true);
  });
});
