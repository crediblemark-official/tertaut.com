/**
 * Utilitas Kriptografi Zero-Dependency berbasis Web Crypto API standar.
 * Kompatibel dengan Browser, Node.js 18+, Bun, dan React Native.
 */

import { isVersionOlder } from "./semver";
import type { OfflineTokenVerifyResult } from "../types";

export function base64urlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/**
 * Verifikasi signature webhook HMAC-SHA256.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  try {
    const normalizedHeader = signatureHeader.replace(/^hmac-sha256=/i, "").trim();
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuf = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
    const hex = Array.from(new Uint8Array(signatureBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hex.toLowerCase() === normalizedHeader.toLowerCase();
  } catch (err) {
    return false;
  }
}

/**
 * Verifikasi offline token Ed25519 secara lokal tanpa internet.
 */
export async function verifyEd25519OfflineToken(
  token: string,
  options?: {
    baseUrl?: string;
    publicKeyJwk?: JsonWebKey;
    jwksUrl?: string;
    appVersion?: string;
  }
): Promise<OfflineTokenVerifyResult> {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) {
      return { valid: false, reason: "MALFORMED_TOKEN" };
    }

    let jwk = options?.publicKeyJwk;
    if (!jwk) {
      const base = options?.baseUrl ?? "";
      const url =
        options?.jwksUrl ?? (base ? `${base}/.well-known/jwks.json` : "/.well-known/jwks.json");
      const res = await fetch(url);
      const jwks = (await res.json()) as { keys?: JsonWebKey[] };
      jwk = jwks.keys?.[0];
    }
    if (!jwk) return { valid: false, reason: "PUBLIC_KEY_UNAVAILABLE" };

    const key = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" } as any, false, [
      "verify",
    ]);
    const signatureBytes = base64urlToBytes(signature);
    const data = new TextEncoder().encode(`${header}.${body}`);
    const ok = await crypto.subtle.verify(
      "Ed25519" as any,
      key,
      signatureBytes as unknown as BufferSource,
      data as unknown as BufferSource
    );
    if (!ok) return { valid: false, reason: "INVALID_SIGNATURE" };

    const claims = JSON.parse(
      new TextDecoder().decode(base64urlToBytes(body))
    ) as OfflineTokenVerifyResult["claims"];

    if (claims?.typ !== "license") return { valid: false, reason: "INVALID_TOKEN_TYPE" };
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, reason: "TOKEN_EXPIRED" };
    }

    if (claims.vfl && options?.appVersion) {
      if (isVersionOlder(options.appVersion, claims.vfl)) {
        return { valid: false, reason: "APP_VERSION_TOO_OLD", claims };
      }
    }

    return { valid: true, claims };
  } catch (err: any) {
    return { valid: false, reason: err?.message || "INVALID_TOKEN" };
  }
}
