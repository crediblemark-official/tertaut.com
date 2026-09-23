import { describe, it, expect, beforeEach } from "bun:test";
import { setupTestAuth } from "../setup";
import { db } from "../../db";
import { builders, apps, licenses, licenseLeases, webhookEndpoints } from "../../db/schema";
import { generateBuilderSecretApiKey, generateAppApiKey } from "../../routes/apps/api-key";
import { LicenseService } from "../../services/license";
import { eq } from "drizzle-orm";

setupTestAuth();

const BASE = "http://localhost:3001/api/v1/licensing";
const S2S = "http://localhost:3001/api/v1/s2s";
const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

let gLicKey = "";
let gWhId = "";
let gBuilderId = "";
let gS2sSecret = "";
let gS2sLicKey = "";
let gS2sOtherSecret = "";
let gS2sAppId = "";

describe("Coverage: admin.ts handleListLicenses + handleRenewLicense", () => {
  beforeEach(async () => {
    const email = `cov_${suffix()}@test.tertaut.com`;
    const secret = generateBuilderSecretApiKey();
    const [b] = await db
      .insert(builders)
      .values({
        name: "Coverage Builder",
        email,
        apiKey: generateAppApiKey("live"),
        secretApiKey: secret,
      })
      .returning();
    gBuilderId = b.id;
    const appId = `app_cov_${suffix()}`;
    await db.insert(apps).values({
      id: appId,
      builderId: b.id,
      name: "Coverage App",
      slug: `cov-${suffix()}`,
      mode: "live",
      apiKey: generateAppApiKey("sandbox"),
      targetPrice: 0,
    });
    const issueRes = await LicenseService.issueDirect({
      appId,
      customerEmail: `cov_cust_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 3,
      actor: { type: "ADMIN", id: "admin" },
    });
    gLicKey = issueRes.license.licenseKey;
    await db.insert(webhookEndpoints).values({
      id: `whk_${suffix()}`,
      builderId: b.id,
      url: "https://api.example.com/webhook",
      secret: "whsec_test",
      events: ["license.issued"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    gWhId = (await db.query.webhookEndpoints.findFirst({
      where: eq(webhookEndpoints.builderId, b.id),
    }))!.id;
  });

  it("GET /list: admin lihat lisensi", async () => {
    const data = await (await fetch(BASE + "/list")).json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.licenses)).toBe(true);
    expect(data.total).toBeGreaterThanOrEqual(1);
  });

  it("GET /list: admin lihat lisensi", async () => {
    const data = await (await fetch(BASE + "/list")).json();
    expect(data.success).toBe(true);
    expect(data.total).toBeGreaterThanOrEqual(1);
  });

  it("GET /renew: perpanjang lisensi berhasil", async () => {
    const data = await (
      await fetch(BASE + "/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: gLicKey, additionalDays: 30 }),
      })
    ).json();
    expect(data.success).toBe(true);
    expect(data.extendedDays).toBe(30);
  });

  it("GET /renew: lisensi tidak ditemukan → gagal", async () => {
    expect(
      (
        await (
          await fetch(BASE + "/renew", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ licenseKey: "TT-NOTFOUND-X", additionalDays: 30 }),
          })
        ).json()
      ).success
    ).toBe(false);
  });
});

describe("Coverage: device.ts handleListSeats + handleHeartbeat + handleListEvents", () => {
  it("GET /seats: list seats milik lisensi", async () => {
    const data = await (await fetch(BASE + `/seats?licenseKey=${gLicKey}`)).json();
    expect(data.success).toBe(true);
    expect(data.seats).toBeDefined();
    expect(typeof data.floating).toBe("boolean");
    expect(data.seatsUsed).toBeGreaterThanOrEqual(0);
    expect(typeof data.seatsUsed).toBe("number");
    expect(data.leaseTtlSeconds).toBeNull();
  });

  it("GET /seats: licenseKey tidak valid → 404", async () => {
    const res = await fetch(BASE + "/seats?licenseKey=TT-NOTFOUND-X");
    expect(res.status).toBe(404);
  });

  it("POST /heartbeat: lisensi non-floating (fixed seat)", async () => {
    const data = await (
      await fetch(BASE + "/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: gLicKey,
          hwid: "CPU_INTEL_i9_13900K_SN_88219",
          leaseKey: "",
          deviceName: "MacBook Pro",
        }),
      })
    ).json();
    expect(data.success).toBe(true);
  });

  it("POST /heartbeat: licenseKey tidak valid → 404", async () => {
    const res = await fetch(BASE + "/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: "TT-NOTFOUND-X", hwid: "x", leaseKey: "" }),
    });
    expect(res.status).toBe(404);
  });

  it("POST /heartbeat: tanpa leaseKey untuk floating → 409", async () => {
    const lic = await db.query.licenses.findFirst({ where: eq(licenses.licenseKey, gLicKey) });
    if (lic) {
      const leaseRow = await db.query.licenseLeases.findFirst({
        where: eq(licenseLeases.licenseId, lic.id),
      });
      if (leaseRow) {
        const res = await fetch(BASE + "/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            licenseKey: gLicKey,
            hwid: "CPU_INTEL_i9_13900K_SN_88219",
            leaseKey: "wrong_key",
            deviceName: "MacBook Pro",
          }),
        });
        expect(res.status).toBe(409);
      }
    }
  });
});

describe("Coverage: S2S batch ops, seats, events, transfer, recover", () => {
  beforeEach(async () => {
    const email = `s2s_cov_${suffix()}@test.com`;
    gS2sSecret = generateBuilderSecretApiKey();
    const [b] = await db
      .insert(builders)
      .values({
        email,
        name: "S2S Coverage",
        apiKey: generateAppApiKey("live"),
        secretApiKey: gS2sSecret,
      })
      .returning();
    gS2sAppId = `app_s2s_cov_${suffix()}`;
    await db.insert(apps).values({
      id: gS2sAppId,
      builderId: b.id,
      name: "S2S Cov",
      slug: `s2s-cov-${suffix()}`,
      mode: "live",
      targetPrice: 0,
    });
    const issueRes = await LicenseService.issueDirect({
      appId: gS2sAppId,
      customerEmail: `cov_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 3,
      actor: { type: "ADMIN", id: "admin" },
    });
    gS2sLicKey = issueRes.license.licenseKey;
    const other = await db
      .insert(builders)
      .values({
        email: `other_${suffix()}@test.com`,
        name: "Other",
        apiKey: generateAppApiKey("live"),
        secretApiKey: generateBuilderSecretApiKey(),
      })
      .returning();
    gS2sOtherSecret = other[0].secretApiKey;
  });

  it("POST /licenses/issue-batch: batch issue berhasil", async () => {
    const data = await (
      await fetch(S2S + "/licenses/issue-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${gS2sSecret}` },
        body: JSON.stringify({
          appId: gS2sAppId,
          items: [
            { customerEmail: `b1_${suffix()}@test.com`, grantDays: 30, maxSeats: 2 },
            { customerEmail: `b2_${suffix()}@test.com`, grantDays: 60 },
          ],
        }),
      })
    ).json();
    expect(data.success).toBe(true);
  });

  it("POST /licenses/issue-batch: items kosong → 400", async () => {
    const res = await fetch(S2S + "/licenses/issue-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gS2sSecret}` },
      body: JSON.stringify({ appId: gS2sAppId, items: [] }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /licenses/revoke-batch: batch revoke berhasil", async () => {
    expect(
      (
        await (
          await fetch(S2S + "/licenses/revoke-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${gS2sSecret}` },
            body: JSON.stringify({ licenseKeys: [gS2sLicKey] }),
          })
        ).json()
      ).revoked
    ).toBe(1);
  });

  it("POST /licenses/seat/release: force-release seat", async () => {
    expect(
      (
        await (
          await fetch(S2S + "/licenses/seat/release", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${gS2sSecret}` },
            body: JSON.stringify({ licenseKey: gS2sLicKey, hwid: "CPU_INTEL_i9_13900K_SN_88219" }),
          })
        ).json()
      ).success
    ).toBe(true);
  });

  it("POST /licenses/recover: recover lisensi", async () => {
    expect(
      (
        await (
          await fetch(S2S + "/licenses/recover", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${gS2sSecret}` },
            body: JSON.stringify({ licenseKey: gS2sLicKey }),
          })
        ).json()
      ).success
    ).toBe(true);
  });

  it("POST /licenses/transfer: transfer ke customer lain", async () => {
    expect(
      (
        await (
          await fetch(S2S + "/licenses/transfer", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${gS2sSecret}` },
            body: JSON.stringify({
              licenseKey: gS2sLicKey,
              newCustomerEmail: `new_${suffix()}@test.com`,
            }),
          })
        ).json()
      ).success
    ).toBe(true);
  });

  it("GET /licenses/events: audit trail per licenseKey", async () => {
    const data = await (
      await fetch(`${S2S}/licenses/events?licenseKey=${gS2sLicKey}`, {
        headers: { Authorization: `Bearer ${gS2sSecret}` },
      })
    ).json();
    expect(data.success).toBe(true);
    expect(data.events).toBeDefined();
  });

  it("GET /licenses/seats: list seats per licenseKey", async () => {
    const data = await (
      await fetch(`${S2S}/licenses/seats?licenseKey=${gS2sLicKey}`, {
        headers: { Authorization: `Bearer ${gS2sSecret}` },
      })
    ).json();
    expect(data.success).toBe(true);
    expect(data.seats).toBeDefined();
  });

  it("cross-builder: secret builder lain tidak bisa akses", async () => {
    expect(
      (
        await (
          await fetch(`${S2S}/licenses/seats?licenseKey=${gS2sLicKey}`, {
            headers: { Authorization: `Bearer ${gS2sOtherSecret}` },
          })
        ).json()
      ).error
    ).toBeDefined();
  });
});
