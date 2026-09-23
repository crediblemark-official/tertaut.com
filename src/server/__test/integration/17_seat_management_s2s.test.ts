import { describe, it, expect } from "bun:test";
import { setupTestAuth } from "../setup";
import { db } from "../../db";
import { apps, builders, licenses } from "../../db/schema";
import { eq, inArray } from "drizzle-orm";
import { generateBuilderSecretApiKey, generateAppApiKey } from "../../routes/apps/api-key";

setupTestAuth();

const BASE = "http://localhost:3001/api/v1/s2s";
const LIC_API = "http://localhost:3001/api/v1/licensing";
const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

let secret = "";
let appId = "";
const authHeaders = () => ({
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
});
const postJson = async (path: string, body?: any) =>
  fetch(BASE + path, {
    method: "POST",
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
const getJson = async (path: string) =>
  fetch(BASE + path, { headers: { Authorization: `Bearer ${secret}` } });

async function setup() {
  secret = generateBuilderSecretApiKey();
  const email = `seat_${suffix()}@test.tertaut.com`;
  const [b] = await db
    .insert(builders)
    .values({
      name: "Seat Builder",
      email,
      apiKey: generateAppApiKey("live"),
      secretApiKey: secret,
    })
    .returning();
  appId = `app_seat_${suffix()}`;
  await db.insert(apps).values({
    id: appId,
    builderId: b.id,
    name: "Seat App",
    slug: `seat-${suffix()}`,
    mode: "sandbox",
    apiKey: generateAppApiKey("sandbox"),
    targetPrice: 0,
    deliveryConfig: { licenseKey: { enabled: true, defaultFeatures: { "ai-4k": true } } },
  });
  return b;
}

describe("Fase 6: Seat management & S2S batch ops", () => {
  it("issue-batch, seats listing, force-release, transfer, recover", async () => {
    await setup();

    // Batch issue 2 lisensi
    const batchRes = await postJson("/licenses/issue-batch", {
      appId,
      items: [
        {
          customerEmail: "seat_a@test.com",
          grantDays: 30,
          maxSeats: 3,
          features: { "ai-4k": true },
        },
        {
          customerEmail: "seat_b@test.com",
          grantDays: 30,
          maxSeats: 3,
          features: { "ai-4k": true },
        },
      ],
    });
    const batch = await batchRes.json();
    expect(batch.success).toBe(true);
    expect(batch.issued).toBe(2);
    expect(batch.failed).toBe(0);
    const licA = batch.licenses[0].licenseKey;
    const licB = batch.licenses[1].licenseKey;

    // Aktifkan satu device di licA
    const act = await fetch(`${LIC_API}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: licA, appId, hwid: "seat-hw-01", deviceName: "Rig 1" }),
    });
    expect(act.status).toBe(200);

    // List seats
    const seatsRes = await getJson(`/licenses/seats?licenseKey=${encodeURIComponent(licA)}`);
    const seats = await seatsRes.json();
    expect(seats.success).toBe(true);
    expect(seats.maxSeats).toBe(3);
    expect(seats.seatsUsed).toBe(1);
    expect(seats.seats.length).toBe(1);
    expect(seats.seats[0].deviceName).toBe("Rig 1");
    expect(seats.seats[0].leaseActive).toBe(null); // non-floating
    const hwidHash = seats.seats[0].hwidHash;

    // Force-release satu seat
    const releaseRes = await postJson("/licenses/seat/release", {
      licenseKey: licA,
      hwid: "seat-hw-01",
    });
    expect((await releaseRes.json()).success).toBe(true);
    const seatsAfter = await (
      await getJson(`/licenses/seats?licenseKey=${encodeURIComponent(licA)}`)
    ).json();
    expect(seatsAfter.seatsUsed).toBe(0);
    expect(seatsAfter.seats.length).toBe(0);

    // Transfer kepemilikan
    const transferRes = await postJson("/licenses/transfer", {
      licenseKey: licA,
      newCustomerEmail: "new_owner@test.com",
    });
    expect((await transferRes.json()).success).toBe(true);
    const licRow = await db.query.licenses.findFirst({ where: eq(licenses.licenseKey, licA) });
    expect(licRow?.customerEmail).toBe("new_owner@test.com");

    // Recover (device hilang) → seluruh seat dibersihkan
    await postJson("/licenses/seat/release", { licenseKey: licA, hwid: "seat-hw-99" }); // no-op
    const recoverRes = await postJson("/licenses/recover", { licenseKey: licA });
    expect((await recoverRes.json()).success).toBe(true);
    const seatsFinal = await (
      await getJson(`/licenses/seats?licenseKey=${encodeURIComponent(licA)}`)
    ).json();
    expect(seatsFinal.seats.length).toBe(0);

    // Revoke batch → kedua lisensi REVOKED
    const revokeBatch = await postJson("/licenses/revoke-batch", { licenseKeys: [licA, licB] });
    const rv = await revokeBatch.json();
    expect(rv.success).toBe(true);
    expect(rv.revoked).toBe(2);
    const rows = await db.query.licenses.findMany({
      where: inArray(licenses.licenseKey, [licA, licB]),
    });
    expect(rows.every((r) => r.status === "REVOKED")).toBe(true);

    // Audit events berisi jejak seat_released & transferred
    const events = await (
      await getJson(`/licenses/events?licenseKey=${encodeURIComponent(licA)}&limit=50`)
    ).json();
    expect(events.success).toBe(true);
    const kinds = events.events.map((e: any) => e.event);
    expect(kinds).toContain("license.transferred");
    expect(kinds).toContain("license.seat_released");
    expect(kinds).toContain("license.recovered");
    expect(kinds).toContain("license.revoked");

    void hwidHash;
  });

  it("webhook endpoint CRUD + rotate secret + test delivery via S2S", async () => {
    await setup();

    const w1 = await postJson("/webhooks", {
      url: "http://127.0.0.1:9/hook",
      events: ["license.issued"],
      secret: "s2s-secret",
    });
    const w1Data = await w1.json();
    expect(w1Data.success).toBe(true);
    const whId = w1Data.webhook.id;

    const list = await (await getJson("/webhooks")).json();
    expect(list.webhooks.some((w: any) => w.id === whId)).toBe(true);
    expect(list.events).toContain("license.activated");

    // Update events → wildcard
    const patched = await fetch(`${BASE}/webhooks/${whId}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ events: [] }),
    });
    const patchData = await patched.json();
    expect(patchData.success).toBe(true);
    expect(patchData.webhook.events).toEqual([]);

    // Rotate secret
    const rotated = await fetch(`${BASE}/webhooks/${whId}/rotate-secret`, {
      method: "POST",
      headers: authHeaders(),
    });
    const rotData = await rotated.json();
    expect(rotData.success).toBe(true);
    expect(rotData.webhook.secret).not.toBe("s2s-secret");

    // Test delivery (endpoint unreachable → tetap terantre, dispatch menandai PENDING + retry)
    const testRes = await fetch(`${BASE}/webhooks/${whId}/test`, {
      method: "POST",
      headers: authHeaders(),
    });
    const testData = await testRes.json();
    expect(testData.success).toBe(true);
    expect(testData.deliveryId).toBeTruthy();

    // Delete
    const del = await fetch(`${BASE}/webhooks/${whId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect((await del.json()).success).toBe(true);
    const listAfter = await (await getJson("/webhooks")).json();
    expect(listAfter.webhooks.some((w: any) => w.id === whId)).toBe(false);
  });

  it("issue-batch menolak item kosong / melebihi 200", async () => {
    await setup();
    const empty = await postJson("/licenses/issue-batch", { appId, items: [] });
    expect(empty.status).toBe(400);

    const tooMany = await postJson("/licenses/issue-batch", {
      appId,
      items: Array.from({ length: 201 }, (_) => ({ customerEmail: `x_${suffix()}@test.com` })),
    });
    expect(tooMany.status).toBe(400);
  });
});
