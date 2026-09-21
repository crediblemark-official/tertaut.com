import { describe, it, expect } from "bun:test";
import { readFileSync } from "fs";
import { createPrivateKey, sign as cryptoSign } from "crypto";
import { setupTestAuth } from "../setup";
import { db } from "../../db";
import { apps, builders, revokedTokens } from "../../db/schema";
import { eq } from "drizzle-orm";
import { LicenseService } from "../../services/license";
import { LicenseTokenService, CLOCK_SKEW_LEEWAY_SECONDS } from "../../services/licenseToken";
import { generateAppApiKey } from "../../routes/apps/api-key";

setupTestAuth();

const BASE = "http://localhost:3001";
const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/** Buat token Ed25519 dengan klaim free-form (untuk menguji skew). */
function craftToken(claims: Record<string, any>): string {
  const pem = readFileSync("keys/license_signing_private.pem", "utf8");
  const key = createPrivateKey(pem);
  const header = base64url(JSON.stringify({ alg: "EdDSA", typ: "JWT" }));
  const body = base64url(JSON.stringify(claims));
  const sig = cryptoSign(null, Buffer.from(`${header}.${body}`), key).toString("base64url");
  return `${header}.${body}.${sig}`;
}

async function makeApp(offlineGraceDays?: number) {
  const email = `th_${suffix()}@test.tertaut.com`;
  const [b] = await db.insert(builders).values({ name: "Token Builder", email, apiKey: generateAppApiKey("live") }).returning();
  const appId = `app_th_${suffix()}`;
  await db.insert(apps).values({
    id: appId,
    builderId: b.id,
    name: "Token App",
    slug: `th-${suffix()}`,
    mode: "sandbox",
    apiKey: generateAppApiKey("sandbox"),
    targetPrice: 0,
    deliveryConfig: {
      licenseKey: {
        enabled: true,
        ...(offlineGraceDays ? { offlineGraceDays } : {}),
      },
    },
  });
  return { b, appId };
}

describe("Fase 5: Token hardening (nbf, clock-skew leeway, rotasi & anti-replay)", () => {
  it("token offline berisi klaim nbf=iat-LEEWAY dan jti; leeway diterapkan", async () => {
    const { appId } = await makeApp(5);
    const issued = await LicenseService.issueDirect({ appId, customerEmail: `th_cust_${suffix()}@test.com`, grantDays: 30, maxSeats: 2 });

    const decoded = LicenseTokenService.verify(issued.license.offlineJwtGraceToken!);
    expect(decoded.valid).toBe(true);
    const claims = decoded.claims!;
    expect(claims.typ).toBe("license");
    expect(claims.jti).toBeTruthy();
    expect(claims.nbf).toBe(claims.iat - CLOCK_SKEW_LEEWAY_SECONDS);
    // offlineGraceDays=5 → exp-iat == 5 hari
    expect(claims.exp - claims.iat).toBe(5 * 24 * 60 * 60);
  });

  it("rotasi via /validate: jti lama di-denylist, token lama ditolak (TOKEN_REVOKED)", async () => {
    const { appId } = await makeApp();
    const issued = await LicenseService.issueDirect({ appId, customerEmail: `th2_cust_${suffix()}@test.com`, grantDays: 30, maxSeats: 2, features: { tier: "pro" } });

    const oldToken = issued.license.offlineJwtGraceToken!;
    const oldDecoded = LicenseTokenService.verify(oldToken);
    expect(oldDecoded.valid).toBe(true);

    // Panggil /validate (online) → token dirotasi oleh server
    const res = await fetch(`${BASE}/api/v1/licensing/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: issued.license.licenseKey, appId }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.valid).toBe(true);
    const newToken = data.offlineGraceToken;
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(oldToken);

    // Denylist berisi jti lama
    const revoked = await db.query.revokedTokens.findFirst({
      where: eq(revokedTokens.jti, oldDecoded.claims!.jti),
    });
    expect(revoked).toBeDefined();
    expect(revoked?.reason).toBe("ROTATED");

    // Token lama ditolak server (anti-replay)
    const oldVerify = await fetch(`${BASE}/api/v1/licensing/verify-offline-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: oldToken }),
    });
    expect(oldVerify.status).toBe(401);
    expect((await oldVerify.json()).reason).toBe("TOKEN_REVOKED");

    // Token baru diterima
    const newVerify = await fetch(`${BASE}/api/v1/licensing/verify-offline-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: newToken }),
    });
    expect(newVerify.status).toBe(200);
    expect((await newVerify.json()).mode).toBe("OFFLINE_GRACE_ACTIVE");
  });

  it("menolak iat terlalu maju (TOO_FORWARD_IAT) dan nbf terlalu jauh (NOT_YET_VALID)", async () => {
    const now = Math.floor(Date.now() / 1000);

    // iat di masa depan melebihi leeway → ditolak
    const forward = craftToken({
      typ: "license", lic: "TT-FORWARD", app: "app-x", hw: null, eml: null,
      seats: 1, feat: null, vfl: null,
      jti: "jti-forward", iat: now + CLOCK_SKEW_LEEWAY_SECONDS + 60,
      nbf: now - CLOCK_SKEW_LEEWAY_SECONDS, exp: now + 86_400,
    });
    const fwd = LicenseTokenService.verify(forward);
    expect(fwd.valid).toBe(false);
    expect(fwd.reason).toBe("TOO_FORWARD_IAT");

    // nbf di masa depan melebihi leeway → ditolak (belum saatnya berlaku)
    const tooEarly = craftToken({
      typ: "license", lic: "TT-EARLY", app: "app-x", hw: null, eml: null,
      seats: 1, feat: null, vfl: null,
      jti: "jti-early", iat: now + CLOCK_SKEW_LEEWAY_SECONDS + 60,
      nbf: now + CLOCK_SKEW_LEEWAY_SECONDS + 360,
      exp: now + 86_400,
    });
    const early = LicenseTokenService.verify(tooEarly);
    expect(early.valid).toBe(false);
    expect(early.reason).toBe("NOT_YET_VALID");

    // nbf di masa depan namun masih dalam leeway (±5 menit) → diterima
    const withinLeeway = craftToken({
      typ: "license", lic: "TT-OK", app: "app-x", hw: null, eml: null,
      seats: 1, feat: null, vfl: null,
      jti: "jti-leeway", iat: now + CLOCK_SKEW_LEEWAY_SECONDS - 10,
      nbf: now + 100, exp: now + 86_400,
    });
    const ok = LicenseTokenService.verify(withinLeeway);
    expect(ok.valid).toBe(true);
  });

  it("token dengan signature rusak dan ttl negatif ditolak", async () => {
    const { appId } = await makeApp();
    const issued = await LicenseService.issueDirect({ appId, customerEmail: `th4_cust_${suffix()}@test.com`, grantDays: 30, maxSeats: 1 });

    const token = issued.license.offlineJwtGraceToken!;
    const [h, b] = token.split(".");
    const tampered = `${h}.${b}.${base64url("broken-signature")}`;
    const bad = LicenseTokenService.verify(tampered);
    expect(bad.valid).toBe(false);
    expect(bad.reason).toBe("INVALID_SIGNATURE");

    const swapped = await LicenseService.issueDirect({ appId, customerEmail: `th5_cust_${suffix()}@test.com`, grantDays: 30, maxSeats: 1 });
    void swapped;
  });
});