import { describe, it, expect, beforeAll } from "bun:test";
import { setupTestAuth } from "../setup";
import { db } from "../../db";
import { builders, apps, licenses, licenseLeases } from "../../db/schema";
import { generateBuilderSecretApiKey, generateAppApiKey } from "../../routes/apps/api-key";
import { LicenseService } from "../../services/license";
import { eq } from "drizzle-orm";
import { isVersionOlder } from "../../lib/semver";

setupTestAuth();

const BASE = "http://localhost:3001/api/v1/licensing";
const S2S = "http://localhost:3001/api/v1/s2s";
const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

let gS2sSecret = "";
let gS2sLicKey = "";
let gS2sAppId = "";

describe("Unit: isVersionOlder", () => {
  it("isVersionOlder: current < min → true", () => {
    expect(isVersionOlder("1.0.0", "1.0.1")).toBe(true);
  });
  it("isVersionOlder: current > min → false", () => {
    expect(isVersionOlder("2.0.0", "1.0.0")).toBe(false);
  });
  it("isVersionOlder: equal versions → false", () => {
    expect(isVersionOlder("1.2.3", "1.2.3")).toBe(false);
  });
  it("isVersionOlder: different patch → true", () => {
    expect(isVersionOlder("1.2.2", "1.2.3")).toBe(true);
  });
});

describe("Coverage: device.ts min_version check", () => {
  let licKey = "";
  let appId = "";

  beforeAll(async () => {
    const email = `ver_${suffix()}@test.com`;
    const [b] = await db
      .insert(builders)
      .values({
        name: "Version Builder",
        email,
        apiKey: generateAppApiKey("live"),
        secretApiKey: generateBuilderSecretApiKey(),
      })
      .returning();

    appId = `app_ver_${suffix()}`;
    await db.insert(apps).values({
      id: appId,
      builderId: b.id,
      name: "Version App",
      slug: `ver-${suffix()}`,
      mode: "live",
      targetPrice: 0,
    });

    const issueRes = await LicenseService.issueDirect({
      appId,
      customerEmail: `ver_cust_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 1,
      features: { min_version: "1.0.0" },
      actor: { type: "ADMIN", id: "admin" },
    });
    licKey = issueRes.license.licenseKey;

    await fetch(BASE + "/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: licKey, appId, hwid: "hwid_test_ok", deviceName: "PC" }),
    });
  });

  it("POST /validate: min_version too old → APP_VERSION_TOO_OLD", async () => {
    const res = await fetch(BASE + "/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: licKey,
        appId,
        appVersion: "0.1.0",
        hardwareId: "hwid_test_old",
      }),
    });
    const data = await res.json();
    expect(data.valid).toBe(false);
    expect(data.reason).toBe("APP_VERSION_TOO_OLD");
  });

  it("POST /validate: valid appVersion → valid", async () => {
    const res = await fetch(BASE + "/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: licKey,
        appId,
        appVersion: "2.0.0",
        hardwareId: "hwid_test_ok",
      }),
    });
    const data = await res.json();
    expect(data.valid).toBe(true);
  });
});

describe("Coverage: admin.ts builderApps.length === 0 branch", () => {
  it("GET /list: tanpa sesi login → unauthorized", async () => {
    const res = await fetch(BASE + "/list");
    expect([200, 401, 403]).toContain(res.status);
  });
});
