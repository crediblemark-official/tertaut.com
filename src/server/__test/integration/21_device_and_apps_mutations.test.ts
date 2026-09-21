import { describe, it, expect, beforeAll } from "bun:test";
import { setupTestAuth, authCookie } from "../setup";
import {
  handleCreateApp,
  handleUpdateApp,
  handleDeleteApp,
  handleUpdateMode,
  handleRotateApiKey,
  handleRotateBuilderSecret,
} from "../../routes/apps/mutations";
import {
  handleUnbindHardware,
  handleDeactivateLicense,
  handleValidateLicense,
  handleHeartbeat,
} from "../../routes/licensing/device";
import { handleAiChat } from "../../routes/aiproxy/chat";
import { LicenseService } from "../../services/license";
import { db } from "../../db";
import { apps, builders, licenses, aiVaultCredentials, aiAppConfigs } from "../../db/schema";
import { eq } from "drizzle-orm";
import { generateAppApiKey } from "../../routes/apps/api-key";

setupTestAuth();

describe("Device Seat Ops, App Mutations, and AI Chat Guardrails", () => {
  let testBuilder: any;
  let testApp: any;
  let adminHeaders: Headers;

  beforeAll(async () => {
    adminHeaders = new Headers({ cookie: authCookie });
    const bList = await db.query.builders.findMany({ limit: 1 });
    if (bList.length > 0) {
      testBuilder = bList[0];
    } else {
      const [b] = await db.insert(builders).values({
        name: "Mut Builder",
        email: `mut_${Date.now()}@test.com`,
        apiKey: generateAppApiKey("live"),
      }).returning();
      testBuilder = b;
    }

    const [a] = await db.insert(apps).values({
      id: `app_mut_${Date.now()}`,
      name: "Mutations Test App",
      slug: `mut-app-${Date.now()}`,
      builderId: testBuilder.id,
      mode: "sandbox",
      targetPrice: 75000,
    }).returning();
    testApp = a;
  });

  it("should test app mutations (create, update, toggle mode, rotate keys, delete)", async () => {
    const set: any = {};

    // 1. handleCreateApp duplicate slug (409)
    const clashRes = await handleCreateApp({
      body: { name: "Clash App", slug: testApp.slug, targetPrice: 50000 },
      set,
      request: { headers: adminHeaders },
    });
    expect(set.status).toBe(409);
    expect(clashRes.error).toContain("sudah digunakan");

    // Valid handleCreateApp
    const newSlug = `new-slug-${Date.now()}`;
    const createRes = await handleCreateApp({
      body: { name: "Created App", slug: newSlug, targetPrice: 99000, mode: "sandbox" },
      set: {},
      request: { headers: adminHeaders },
    });
    expect(createRes.success).toBe(true);
    const createdAppId = createRes.app!.id;

    // 2. handleUpdateApp
    const updateNotFound = await handleUpdateApp({ params: { appId: "fake_id" }, body: {}, set, request: { headers: adminHeaders } });
    expect(set.status).toBe(404);

    const updateRes = await handleUpdateApp({
      params: { appId: createdAppId },
      body: { name: "Updated Name", headline: "Super Headline" },
      set: {},
      request: { headers: adminHeaders },
    });
    expect(updateRes.success).toBe(true);
    expect(updateRes.app!.name).toBe("Updated Name");

    // 3. handleUpdateMode
    const modeNotFound = await handleUpdateMode({ params: { appId: "fake_id" }, body: { mode: "live" }, set, request: { headers: adminHeaders } });
    expect(set.status).toBe(404);

    const modeRes = await handleUpdateMode({
      params: { appId: createdAppId },
      body: { mode: "live" },
      set: {},
      request: { headers: adminHeaders },
    });
    expect(modeRes.success).toBe(true);
    expect(modeRes.app!.mode).toBe("live");

    // 4. handleRotateApiKey
    const rotateNotFound = await handleRotateApiKey({ params: { appId: "fake_id" }, set, request: { headers: adminHeaders } });
    expect(set.status).toBe(404);

    const rotateRes = await handleRotateApiKey({
      params: { appId: createdAppId },
      set: {},
      request: { headers: adminHeaders },
    });
    expect(rotateRes.success).toBe(true);
    expect(rotateRes.app!.apiKey).toBeDefined();

    // 5. handleRotateBuilderSecret
    const rotateSecretRes = await handleRotateBuilderSecret({ request: { headers: adminHeaders }, set: {} });
    expect(rotateSecretRes.success).toBe(true);
    expect(rotateSecretRes.secretApiKey).toBeDefined();

    // 6. handleDeleteApp
    const deleteNotFound = await handleDeleteApp({ params: { appId: "fake_id" }, set, request: { headers: adminHeaders } });
    expect(set.status).toBe(404);

    const deleteRes = await handleDeleteApp({
      params: { appId: createdAppId },
      set: {},
      request: { headers: adminHeaders },
    });
    expect(deleteRes.success).toBe(true);
  });

  it("should test device unbind hardware, deactivate license, and heartbeat", async () => {
    const set: any = {};

    // 1. Issue a test license with active activation
    const issueRes = await LicenseService.issueDirect({
      appId: testApp.id,
      customerEmail: `dev_ops_${Date.now()}@test.com`,
      grantDays: 30,
      maxSeats: 2,
      actor: { type: "ADMIN", id: "admin" },
    });
    const lic = issueRes.license;

    // Activate a device
    await fetch("http://localhost:3001/api/v1/licensing/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: lic.licenseKey,
        appId: testApp.id,
        hwid: "HWID_TEST_LAPTOP_1",
        deviceName: "Test-Laptop",
      }),
    });

    // 2. handleHeartbeat
    const hbMissing = await handleHeartbeat({ body: {}, set });
    expect(set.status).toBe(400);

    const hbNotFound = await handleHeartbeat({ body: { licenseKey: "TT-FAKE-KEY-0000" }, set });
    expect(set.status).toBe(404);

    const hbSuccess = await handleHeartbeat({
      body: { licenseKey: lic.licenseKey, hwid: "HWID_TEST_LAPTOP_1" },
      set: {},
    });
    expect(hbSuccess.success).toBe(true);

    // 3. handleDeactivateLicense
    const deactMissing = await handleDeactivateLicense({ body: {}, set });
    expect(set.status).toBe(400);

    const deactNotFound = await handleDeactivateLicense({ body: { licenseKey: "TT-FAKE-KEY-0000" }, set });
    expect(set.status).toBe(404);

    const deactWrongHwid = await handleDeactivateLicense({
      body: { licenseKey: lic.licenseKey, hwid: "UNKNOWN_HWID" },
      set,
    });
    expect(set.status).toBe(404);

    // 4. handleUnbindHardware
    const unbindMissing = await handleUnbindHardware({ body: {}, set });
    expect(set.status).toBe(400);

    const unbindNotFound = await handleUnbindHardware({ body: { licenseKey: "TT-FAKE-000" }, set });
    expect(set.status).toBe(404);

    // Unbind specific device
    const unbindSpecific = await handleUnbindHardware({
      body: { licenseKey: lic.licenseKey, hwid: "HWID_TEST_LAPTOP_1" },
      set: {},
      request: { headers: adminHeaders },
    });
    expect(unbindSpecific.success).toBe(true);

    // Unbind all devices
    const unbindAll = await handleUnbindHardware({
      body: { licenseKey: lic.licenseKey },
      set: {},
      request: { headers: adminHeaders },
    });
    expect(unbindAll.success).toBe(true);

    // 5. handleValidateLicense
    const validateRes = await handleValidateLicense({
      body: {
        licenseKey: lic.licenseKey,
        appId: lic.appId,
      },
      set: {},
    });
    expect(validateRes.valid).toBe(true);
  });

  it("should test AI chat completion guardrails (empty prompt, kill switch, mock response)", async () => {
    const set: any = {};

    const issueRes = await LicenseService.issueDirect({
      appId: testApp.id,
      customerEmail: `ai_chat_${Date.now()}@test.com`,
      grantDays: 30,
      maxSeats: 1,
      actor: { type: "ADMIN", id: "admin" },
    });
    const lic = issueRes.license;

    // 1. Empty prompt (400)
    const emptyPromptRes: any = await handleAiChat({
      body: { licenseKey: lic.licenseKey, appId: testApp.id, prompt: "" },
      set,
    });
    expect(set.status).toBe(400);
    expect(emptyPromptRes.error).toBe("EMPTY_PROMPT");

    // 2. Kill switch active (429)
    await db.insert(aiVaultCredentials).values({
      appId: testApp.id,
      provider: "openai",
      encryptedApiKey: "test_cipher",
      iv: "test_iv",
      authTag: "test_tag",
      isKillSwitchActive: true,
    });

    const killSwitchRes: any = await handleAiChat({
      body: { licenseKey: lic.licenseKey, appId: testApp.id, prompt: "Halo AI" },
      set,
    });
    expect(set.status).toBe(429);
    expect(killSwitchRes.error).toBe("AI_KILL_SWITCH_ACTIVE");

    // 3. Deactivate kill switch and test successful chat in sandbox
    const { CryptoService } = await import("../../services/crypto");
    const enc = CryptoService.encrypt("mock-openai-key");
    await db.update(aiVaultCredentials)
      .set({ isKillSwitchActive: false, encryptedApiKey: enc.cipherText, iv: enc.iv, authTag: enc.authTag })
      .where(eq(aiVaultCredentials.appId, testApp.id));

    const chatSuccess: any = await handleAiChat({
      body: {
        licenseKey: lic.licenseKey,
        appId: testApp.id,
        prompt: "Halo AI!",
        modelAlias: "default",
      },
      set: {},
    });
    expect(chatSuccess.success).toBe(true);
    expect(chatSuccess.text).toBeDefined();
    expect(chatSuccess.usage).toBeDefined();
  });
});
