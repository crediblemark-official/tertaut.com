import { describe, it, expect } from "bun:test";
import { setupTestAuth } from "../setup";
import { db } from "../../db";
import { apps, builders, licenseLeases } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { LicenseService } from "../../services/license";
import { generateBuilderSecretApiKey, generateAppApiKey } from "../../routes/apps/api-key";

setupTestAuth();

const BASE = "http://localhost:3000";
const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function setupFloatingApp(leaseTtlSeconds = 30) {
  const email = `fl_${suffix()}@test.tertaut.com`;
  const [b] = await db
    .insert(builders)
    .values({ name: "Floating Builder", email, apiKey: generateAppApiKey("live"), secretApiKey: generateBuilderSecretApiKey() })
    .returning();
  const appId = `app_fl_${suffix()}`;
  await db.insert(apps).values({
    id: appId,
    builderId: b.id,
    name: "Floating App",
    slug: `fl-${suffix()}`,
    mode: "sandbox",
    apiKey: generateAppApiKey("sandbox"),
    targetPrice: 0,
    deliveryConfig: {
      licenseKey: {
        enabled: true,
        floating: { enabled: true, leaseTtlSeconds, heartbeatIntervalSeconds: 10 },
        defaultFeatures: { "ai-4k": true },
      },
    },
  });
  return { b, appId };
}

async function activate(licenseKey: string, appId: string, hwid: string, deviceName = "PC") {
  const res = await fetch(`${BASE}/api/v1/licensing/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ licenseKey, appId, hwid, deviceName }),
  });
  return { status: res.status, json: await res.json() };
}

describe("Fase 2: Floating License (rolling seat via lease + heartbeat)", () => {
  it("aktivasi floating mengembalikan leaseKey, heartbeat memperpanjang lease, seat keluar dari pool saat lease mati", async () => {
    const { appId } = await setupFloatingApp(30);
    const issued = await LicenseService.issueDirect({
      appId,
      customerEmail: `fl_cust_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 2,
      features: { "ai-4k": true },
    });
    const licKey = issued.license.licenseKey;

    // Aktivasi device A → floating + leaseKey
    const actA = await activate(licKey, appId, "hwid-a-001", "Laptop A");
    expect(actA.status).toBe(200);
    expect(actA.json.data.floating).toBe(true);
    const leaseKeyA = actA.json.data.leaseKey;
    expect(leaseKeyA).toMatch(/^lk_/);

    // Heartbeat dengan leaseKey benar → lease diperpanjang
    const hb = await fetch(`${BASE}/api/v1/licensing/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, licenseKey: licKey, hwid: "hwid-a-001", leaseKey: leaseKeyA, deviceName: "Laptop A" }),
    });
    expect(hb.status).toBe(200);
    const hbData = await hb.json();
    expect(hbData.success).toBe(true);
    expect(hbData.floating).toBe(true);
    expect(hbData.leaseKey).toBe(leaseKeyA);
    expect(new Date(hbData.leaseExpiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(hbData.seatsUsed).toBe(1);

    // Heartbeat dengan leaseKey salah → LEASE_MISMATCH
    const hbBad = await fetch(`${BASE}/api/v1/licensing/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, licenseKey: licKey, hwid: "hwid-a-001", leaseKey: "lk_bogus_123" }),
    });
    expect(hbBad.status).toBe(409);
    expect((await hbBad.json()).reason).toBe("LEASE_MISMATCH");

    // Verify device A (aktif) masih valid
    const v1 = await fetch(`${BASE}/api/v1/licensing/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: licKey, hwid: "hwid-a-001" }),
    });
    expect(v1.status).toBe(200);
    expect((await v1.json()).status).toBe("ACTIVE");

    // Device B aktif → seat 2/2 terisi
    const actB = await activate(licKey, appId, "hwid-b-002", "Laptop B");
    expect(actB.status).toBe(200);
    const leaseKeyB = actB.json.data.leaseKey;
    expect(actB.json.data.seatsUsed).toBe(2);

    // Device C mencoba aktif → kuota penuh (harus ditolak, seat_full)
    const actC = await activate(licKey, appId, "hwid-c-003", "Laptop C");
    expect(actC.status).toBe(403);

    // Simulasikan lease B yang mati (tidak pernah heartbeat) → langsung di-DB ke masa lalu
    await db
      .update(licenseLeases)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(and(eq(licenseLeases.licenseId, issued.license.id), eq(licenseLeases.hwidHash, LicenseService.hashHardwareIdSecure("hwid-b-002"))));

    // Device C kini mendapat slot rolling (seat hidup B sudah bebas)
    const actC2 = await activate(licKey, appId, "hwid-c-003", "Laptop C");
    expect(actC2.status).toBe(200);
    expect(actC2.json.data.seatsUsed).toBe(2);

    // Verify device B yang leasenya mati → LEASE_STALE
    const vB = await fetch(`${BASE}/api/v1/licensing/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: licKey, hwid: "hwid-b-002" }),
    });
    expect(vB.status).toBe(200);
    const vBData = await vB.json();
    expect(vBData.valid).toBe(false);
    expect(vBData.status).toBe("LEASE_STALE");

    // Deactivate device A → lease ikut dilepas (baris lease dihapus, bukan sekadar luput)
    const da = await fetch(`${BASE}/api/v1/licensing/deactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: licKey, hwid: "hwid-a-001" }),
    });
    expect(da.status).toBe(200);
    const kv = await db.query.licenseLeases.findMany({
      where: eq(licenseLeases.licenseId, issued.license.id),
    });
    const aLease = kv.find((l) => l.hwidHash === LicenseService.hashHardwareIdSecure("hwid-a-001"));
    expect(aLease).toBeUndefined(); // lease A dihapus permanen saat deactivate
    expect(kv.some((l) => l.hwidHash === LicenseService.hashHardwareIdSecure("hwid-c-003"))).toBe(true);

    void leaseKeyB;
  });

  it("license non-floating: heartbeat berfungsi sebagai keep-alive tanpa lease", async () => {
    const email = `nf_${suffix()}@test.tertaut.com`;
    const [b] = await db.insert(builders).values({ name: "Plain Builder", email, apiKey: generateAppApiKey("live") }).returning();
    const appId = `app_nf_${suffix()}`;
    await db.insert(apps).values({
      id: appId,
      builderId: b.id,
      name: "Plain App",
      slug: `nf-${suffix()}`,
      mode: "sandbox",
      apiKey: generateAppApiKey("sandbox"),
      targetPrice: 0,
    });

    const issued = await LicenseService.issueDirect({ appId, customerEmail: `nf_cust_${suffix()}@test.com`, grantDays: 30, maxSeats: 1 });
    const hb = await fetch(`${BASE}/api/v1/licensing/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, licenseKey: issued.license.licenseKey, hwid: "nf-device", leaseKey: "" }),
    });
    expect(hb.status).toBe(200);
    const data = await hb.json();
    expect(data.success).toBe(true);
    expect(data.floating).toBe(false);
    expect(data.status).toBe("ACTIVE");
  });
});