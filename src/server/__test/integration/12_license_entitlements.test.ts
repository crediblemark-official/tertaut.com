import { describe, it, expect } from "bun:test";
import { setupTestAuth } from "../setup";
import { db } from "../../db";
import { apps, licenses, builders } from "../../db/schema";
import { eq } from "drizzle-orm";
import { LicenseService } from "../../services/license";
import { LicenseTokenService } from "../../services/licenseToken";
import { Tertaut } from "../../../../packages/sdk/src";

setupTestAuth();

const BASE = "http://localhost:3001";
const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

describe("Fase 0 & Fase 1: License Schema & Feature Flags Entitlements", () => {
  it("harus menerbitkan lisensi dengan licenseVersion=1, features JSONB, dan claims Ed25519 feat/vfl", async () => {
    const email = `builder_feat_${suffix()}@test.com`;
    const [b] = await db
      .insert(builders)
      .values({
        name: "Feature Builder",
        email,
        apiKey: `tt_live_feat_builder_${suffix()}`,
      })
      .returning();

    const appId = `app_feat_${suffix()}`;
    await db.insert(apps).values({
      id: appId,
      builderId: b.id,
      name: "Feature Test App",
      slug: `slug-feat-${suffix()}`,
      targetPrice: 0,
      mode: "sandbox",
      apiKey: `tt_test_sample_key_${suffix()}`,
      deliveryConfig: {
        licenseKey: {
          enabled: true,
          defaultFeatures: {
            "ai-4k": true,
            max_users: 50,
            min_version: "2.4.0",
          },
        },
      },
    });

    const customFeatures = {
      "ai-4k": true,
      tier: "enterprise",
      max_users: 100,
      min_version: "2.4.0",
    };

    const issued = await LicenseService.issueDirect({
      appId,
      customerEmail: "cust_feat@test.com",
      grantDays: 30,
      maxSeats: 3,
      features: customFeatures,
    });

    expect(issued.license).toBeDefined();
    expect(issued.license.licenseVersion).toBe(1);
    expect(issued.license.features).toEqual(customFeatures);

    // Verifikasi klaim offline token Ed25519
    const decoded = LicenseTokenService.verify(issued.license.offlineJwtGraceToken!);
    expect(decoded.valid).toBe(true);
    expect(decoded.claims).toBeDefined();
    expect(decoded.claims?.feat).toEqual(customFeatures);
    expect(decoded.claims?.vfl).toBe("2.4.0");

    // Uji endpoint /api/v1/licensing/verify online
    const verifyRes = await fetch(`${BASE}/api/v1/licensing/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: issued.license.licenseKey,
        appVersion: "2.4.1",
      }),
    });
    expect(verifyRes.status).toBe(200);
    const verifyData = await verifyRes.json();
    expect(verifyData.valid).toBe(true);
    expect(verifyData.entitlements).toEqual(customFeatures);
    expect(verifyData.licenseVersion).toBe(1);

    // Uji enforcement version floor (appVersion terlalu lama -> HTTP 403 APP_VERSION_TOO_OLD)
    const oldVersionRes = await fetch(`${BASE}/api/v1/licensing/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: issued.license.licenseKey,
        appVersion: "2.3.9",
      }),
    });
    expect(oldVersionRes.status).toBe(403);
    const oldVersionData = await oldVersionRes.json();
    expect(oldVersionData.valid).toBe(false);
    expect(oldVersionData.reason).toBe("APP_VERSION_TOO_OLD");
    expect(oldVersionData.minVersion).toBe("2.4.0");

    // Uji online /validate version floor
    const oldValidateRes = await fetch(`${BASE}/api/v1/licensing/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: issued.license.licenseKey,
        appId,
        appVersion: "1.0.0",
      }),
    });
    expect(oldValidateRes.status).toBe(403);
    const oldValidateData = await oldValidateRes.json();
    expect(oldValidateData.valid).toBe(false);
    expect(oldValidateData.reason).toBe("APP_VERSION_TOO_OLD");

    // Uji SDK licensing.entitlements()
    const sdk = new Tertaut({
      apiKey: "tt_test_sample_key_123",
      appId,
      baseUrl: BASE,
    });

    const entResult = await sdk.licensing.entitlements({
      licenseKey: issued.license.licenseKey,
      appVersion: "2.5.0",
    });
    expect(entResult.valid).toBe(true);
    expect(entResult.entitlements).toEqual(customFeatures);
    expect(entResult.licenseVersion).toBe(1);

    // Uji SDK verifyOfflineToken dengan version floor check
    const offlineValid = await sdk.licensing.verifyOfflineToken(
      issued.license.offlineJwtGraceToken!,
      {
        appVersion: "2.4.0",
      }
    );
    expect(offlineValid.valid).toBe(true);
    expect(offlineValid.claims?.feat).toEqual(customFeatures);

    const offlineTooOld = await sdk.licensing.verifyOfflineToken(
      issued.license.offlineJwtGraceToken!,
      {
        appVersion: "2.1.0",
      }
    );
    expect(offlineTooOld.valid).toBe(false);
    expect(offlineTooOld.reason).toBe("APP_VERSION_TOO_OLD");
  });
});
