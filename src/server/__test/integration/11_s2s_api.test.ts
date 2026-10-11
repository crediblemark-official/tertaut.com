import { describe, it, expect, afterAll } from "bun:test";
import { setupTestAuth } from "../setup";
import { db } from "../../db";
import { builders, apps, licenses } from "../../db/schema";
import { eq } from "drizzle-orm";
import { generateBuilderSecretApiKey, generateAppApiKey } from "../../routes/apps/api-key";

setupTestAuth();

const BASE = "http://localhost:3001/api/v1/s2s";
const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

let builderEmail = "";
let otherBuilderId = "";
let appId = "";
let secret = "";
let licKey = "";

const authHeaders = () => ({
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
});

async function postJson(path: string, body?: any) {
  return fetch(BASE + path, {
    method: "POST",
    headers: body ? authHeaders() : { Authorization: authHeaders().Authorization },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("S2S Server-to-Server API (secret API key)", () => {
  it("menolak akses tanpa secret key atau secret key salah (401)", async () => {
    const noKey = await fetch(`${BASE}/`);
    expect(noKey.status).toBe(401);

    const badKey = await fetch(`${BASE}/`, {
      headers: { Authorization: "Bearer tt_secret_" + "a".repeat(10) },
    });
    expect(badKey.status).toBe(401);
  });

  it("end-to-end: info, apps, issue, list, revoke", async () => {
    // Setup builder + app milik builder (secret API key khusus test)
    const email = `s2s_${suffix()}@test.tertaut.com`;
    secret = generateBuilderSecretApiKey();
    const [b] = await db
      .insert(builders)
      .values({
        email,
        name: "S2S Tester",
        apiKey: generateAppApiKey("live"),
        secretApiKey: secret,
      })
      .returning();
    builderEmail = email;

    appId = `app_s2s_${suffix()}`;
    await db.insert(apps).values({
      id: appId,
      builderId: b.id,
      apiKey: generateAppApiKey("live"),
      name: "S2S App",
      slug: `s2s-${suffix()}`,
      mode: "live",
      targetPrice: 50000,
    });

    // Info akun
    const me = await (await fetch(`${BASE}/`, { headers: authHeaders() })).json();
    expect(me.builder.email).toBe(email);

    // List app milik builder
    const appsRes = await (await fetch(`${BASE}/apps`, { headers: authHeaders() })).json();
    expect(appsRes.some((a: any) => a.id === appId)).toBe(true);

    // Terbitkan lisensi
    const issueRes = await (
      await postJson("/licenses/issue", {
        appId,
        customerEmail: `cust_${suffix()}@test.tertaut.com`,
        grantDays: 30,
      })
    ).json();
    expect(issueRes.success).toBe(true);
    licKey = issueRes.license.licenseKey;

    // List lisensi per app
    const listLic = await (
      await fetch(`${BASE}/licenses?appId=${appId}`, { headers: authHeaders() })
    ).json();
    expect(listLic.licenses.some((l: any) => l.licenseKey === licKey)).toBe(true);

    // Cabut lisensi
    const revokeRes = await (await postJson("/licenses/revoke", { licenseKey: licKey })).json();
    expect(revokeRes.success).toBe(true);

    // Cross-builder: secret key builder lain TIDAK boleh menyentuh lisensi ini
    const [other] = await db
      .insert(builders)
      .values({
        email: `other_${suffix()}@test.tertaut.com`,
        name: "Other Builder",
        apiKey: generateAppApiKey("live"),
        secretApiKey: generateBuilderSecretApiKey(),
      })
      .returning();
    otherBuilderId = other.id;

    const evil = await (
      await fetch(`${BASE}/credits/balance?licenseKey=${licKey}`, {
        headers: { Authorization: `Bearer ${other.secretApiKey}` },
      })
    ).json();
    expect(evil.error).toBeDefined();

    // Scoping query mode: builder B memanggil /apps?mode=live tidak boleh melihat app milik builder A
    const otherAppsRes = await (
      await fetch(`${BASE}/apps?mode=live`, {
        headers: { Authorization: `Bearer ${other.secretApiKey}` },
      })
    ).json();
    expect(otherAppsRes.some((a: any) => a.id === appId)).toBe(false);
  });

  afterAll(async () => {
    await db.delete(licenses).where(eq(licenses.licenseKey, licKey));
    await db.delete(apps).where(eq(apps.id, appId));
    await db.delete(builders).where(eq(builders.email, builderEmail));
    await db.delete(builders).where(eq(builders.id, otherBuilderId));
  });
});
