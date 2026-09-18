import { describe, it, expect } from "bun:test";
import { setupTestAuth } from "../setup";
import { db } from "../../db";
import { apps, builders } from "../../db/schema";
import { LicenseService } from "../../services/license";
import { AuditService } from "../../services/audit";
import { generateBuilderSecretApiKey, generateAppApiKey } from "../../routes/apps/api-key";

setupTestAuth();

const BASE = "http://localhost:3000/api/v1/s2s";
const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function setupBuilderWithApp() {
  const secret = generateBuilderSecretApiKey();
  const email = `aud_${suffix()}@test.tertaut.com`;
  const [b] = await db
    .insert(builders)
    .values({ name: "Audit Builder", email, apiKey: generateAppApiKey("live"), secretApiKey: secret })
    .returning();
  const appId = `app_aud_${suffix()}`;
  await db.insert(apps).values({
    id: appId,
    builderId: b.id,
    name: "Audit App",
    slug: `aud-${suffix()}`,
    mode: "sandbox",
    apiKey: generateAppApiKey("sandbox"),
    targetPrice: 0,
  });
  return { b, appId, secret };
}

describe("Fase 4: Audit trail license lifecycle (append-only event log)", () => {
  it("activity license ditulis kronologis dan bisa difilter via S2S events", async () => {
    const { b, appId, secret } = await setupBuilderWithApp();
    const issued = await LicenseService.issueDirect({
      appId,
      customerEmail: `aud_cust_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 3,
      actor: { type: "ADMIN", id: "admin-101" },
      ipAddress: "10.0.0.1",
    });
    const licKey = issued.license.licenseKey;

    // Satu baris audit saat issuance
    let events = await AuditService.query({ licenseKey: licKey });
    const issuedEvents = events.events.filter((e: any) => e.event === "license.issued");
    expect(issuedEvents.length).toBe(1);
    expect(issuedEvents[0].actorType).toBe("ADMIN");
    expect(issuedEvents[0].ipAddress).toBe("10.0.0.1");
    expect(events.total).toBeGreaterThanOrEqual(1);

    // Aktivasi → deaktivasi → revoke
    const LIC_API = "http://localhost:3000/api/v1/licensing";
    const act = await fetch(`${LIC_API}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: licKey, appId, hwid: "aud-hw-1" }),
    });
    expect(act.status).toBe(200);
    const deact = await fetch(`${LIC_API}/deactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: licKey, hwid: "aud-hw-1" }),
    });
    expect(deact.status).toBe(200);
    await LicenseService.revoke({ licenseId: issued.license.id, actor: { type: "S2S", id: b.id }, ipAddress: "s2s-gw" });

    events = await AuditService.query({ licenseKey: licKey, limit: 100 });
    const kinds = events.events.map((e: any) => e.event);
    expect(kinds).toContain("license.issued");
    expect(kinds).toContain("license.activated");
    expect(kinds).toContain("license.deactivated");
    expect(kinds).toContain("license.revoked");

    // Urutannya menurun (terbaru dulu)
    const ts = events.events.map((e: any) => new Date(e.createdAt).getTime());
    expect(ts).toEqual([...ts].sort((a, b) => b - a));

    // Filter event spesifik
    const onlyRevoked = await AuditService.query({ licenseKey: licKey, event: "license.revoked" });
    expect(onlyRevoked.events.length).toBe(1);
    expect(onlyRevoked.events[0].actorType).toBe("S2S");

    // Scope builder: S2S events dengan licenseKey miliknya — endpoint dan total konsisten
    const s2s = await fetch(`${BASE}/licenses/events?licenseKey=${encodeURIComponent(licKey)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    expect(s2s.status).toBe(200);
    const s2sData = await s2s.json();
    expect(s2sData.success).toBe(true);
    expect(s2sData.total).toBeGreaterThanOrEqual(4);
  });

  it("builder lain tidak bisa mengintip event license milik builder lain (404)", async () => {
    const { b, appId } = await setupBuilderWithApp();
    const { secret: otherSecret } = await setupBuilderWithApp();

    const issued = await LicenseService.issueDirect({
      appId,
      customerEmail: `aud2_cust_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 1,
      actor: { type: "ADMIN" },
    });

    const res = await fetch(`${BASE}/licenses/events?licenseKey=${encodeURIComponent(issued.license.licenseKey)}`, {
      headers: { Authorization: `Bearer ${otherSecret}` },
    });
    expect(res.status).toBe(404);

    void b;
  });
});