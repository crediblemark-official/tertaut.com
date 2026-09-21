import { describe, it, expect } from "bun:test";
import { setupTestAuth } from "../setup";
import { DanaService } from "../../services/dana";
import { LicenseService } from "../../services/license";
import { LicenseTokenService } from "../../services/licenseToken";

setupTestAuth();

describe("App End-to-End Validation & MoR Calculations", () => {
  it("should verify 5% MoR cut holds true for micro-transactions", () => {
    const prices = [10000, 25000, 49000, 99000, 149000, 299000];
    for (const p of prices) {
      const { grossAmount, platformFee, netAmount } = DanaService.calculateMorBreakdown(p);
      expect(grossAmount).toBe(p);
      expect(platformFee + netAmount).toBe(grossAmount);
      expect(platformFee).toBe(Math.round(p * 0.05));
    }
  });

  it("should correctly handle offline license token expiration timestamps", () => {
    const token = LicenseService.createOfflineGraceToken("TT-VALID-9999", "app_test");
    const result = LicenseTokenService.verify(token);
    expect(result.valid).toBe(true);
    expect(result.claims?.typ).toBe("license");
    // Verify exp is ~30 days in future
    const now = Math.floor(Date.now() / 1000);
    expect(result.claims!.exp).toBeGreaterThan(now + 25 * 86400);
  });
});

describe("PRD Module 1: Page Blocks & App Configuration", () => {
  it("should save pageBlocks to app via PATCH /api/v1/apps/:appId", async () => {
    // First, get the first app
    const appsRes = await fetch("http://localhost:3000/api/v1/apps");
    const appsData: any = await appsRes.json();
    expect(appsRes.status).toBe(200);

    if (!appsData.apps || appsData.apps.length === 0) {
      console.warn("No apps found, skipping pageBlocks test");
      return;
    }

    const testApp = appsData.apps[0];

    // Construct minimal content blocks
    const testBlocks = [
      {
        id: "blk_hero_test",
        type: "hero",
        title: "Test Hero Block",
        enabled: true,
        content: {
          appName: testApp.name,
          headline: "Test Headline dari Unit Test",
          subheadline: "Unit test otomatis untuk memvalidasi penyimpanan pageBlocks.",
          tag: "Unit Test",
        },
      },
      {
        id: "blk_cta_test",
        type: "intent_cta",
        title: "Test CTA Block",
        enabled: true,
        content: {
          ctaText: "Beli via Test — Rp 49.000",
          price: 49000,
          strikePrice: 98000,
          guaranteeText: "Garansi 14 Hari atau Uang Kembali",
        },
      },
    ];

    // Save pageBlocks via PATCH
    const patchRes = await fetch(`http://localhost:3000/api/v1/apps/${testApp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageBlocks: testBlocks }),
    });
    const patchData: any = await patchRes.json();
    expect(patchRes.status).toBe(200);
    expect(patchData.success).toBe(true);
    expect(patchData.app.pageBlocks).toBeDefined();
    expect(Array.isArray(patchData.app.pageBlocks)).toBe(true);
    expect(patchData.app.pageBlocks.length).toBe(2);
    expect(patchData.app.pageBlocks[0].type).toBe("hero");
    expect(patchData.app.pageBlocks[1].type).toBe("intent_cta");
  });
});
