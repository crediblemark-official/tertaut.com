import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from "crypto";
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { config } from "../config";

export interface LicenseTokenClaims {
  typ: "license";
  lic: string; // license key (sub)
  app: string; // appId
  hw: string | null; // hardware hash bound to the token
  eml: string | null; // customer email
  seats: number;
  jti: string;
  iat: number;
  exp: number;
}

export interface VerifyLicenseTokenResult {
  valid: boolean;
  reason?: string;
  claims?: LicenseTokenClaims;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Ed25519 (asimetris) offline license token service.
 * Private key dari LICENSE_SIGNING_PRIVATE_KEY; di dev di-generate otomatis.
 */
export class LicenseTokenService {
  private static privateKey: KeyObject | null = null;
  private static publicKeyPem: string | null = null;
  private static jwkCache: Record<string, string> | null = null;
  private static kid: string | null = null;

  private static init(): void {
    if (this.privateKey) return;

    const envKey = config.security.licensePrivateKey;
    let privateKeyPem: string;

    if (envKey && envKey.includes("PRIVATE KEY")) {
      // Perbaiki escape newline yang umum dipakai di env var.
      privateKeyPem = envKey.replace(/\\n/g, "\n");
    } else if (!config.isProd) {
      const generated = generateKeyPairSync("ed25519");
      privateKeyPem = generated.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
      try {
        const devKeyPath = "keys/license_signing_private.pem";
        if (!existsSync("keys")) mkdirSync("keys", { recursive: true });
        if (!existsSync(devKeyPath)) {
          writeFileSync(devKeyPath, privateKeyPem, { mode: 0o600 });
        }
      } catch {}
    } else {
      throw new Error(
        "[LicenseToken] LICENSE_SIGNING_PRIVATE_KEY wajib diisi di production untuk token lisensi Ed25519."
      );
    }

    this.privateKey = createPrivateKey(privateKeyPem);
    const publicKey = createPublicKey(this.privateKey);
    this.publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

    const jwk = publicKey.export({ format: "jwk" }) as { kty: string; crv: string; x: string };
    this.kid = createHash("sha256")
      .update(Buffer.from(jwk.x, "base64url"))
      .digest("hex")
      .slice(0, 16);
    this.jwkCache = {
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      use: "sig",
      alg: "EdDSA",
      kid: this.kid,
    };
  }

  /** Terbitkan token lisensi Ed25519 dengan `jti` unik. */
  static sign(
    payload: Omit<LicenseTokenClaims, "typ" | "jti" | "iat" | "exp"> & { ttlSeconds?: number }
  ): string {
    this.init();
    const { ttlSeconds = 30 * 24 * 60 * 60, ...rest } = payload;

    const now = Math.floor(Date.now() / 1000);
    const claims: LicenseTokenClaims = {
      ...rest,
      typ: "license",
      jti: randomBytes(16).toString("hex"),
      iat: now,
      exp: now + ttlSeconds,
    };

    const header = base64url(JSON.stringify({ alg: "EdDSA", typ: "JWT", kid: this.kid }));
    const body = base64url(JSON.stringify(claims));
    const signature = cryptoSign(null, Buffer.from(`${header}.${body}`), this.privateKey!).toString(
      "base64url"
    );

    return `${header}.${body}.${signature}`;
  }

  /** Verifikasi tanda tangan Ed25519 + masa berlaku (tanpa cek DB). */
  static verify(token: string): VerifyLicenseTokenResult {
    this.init();
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return { valid: false, reason: "MALFORMED_TOKEN" };

      const [header, body, signature] = parts;
      const headerJson = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
      if (headerJson.alg !== "EdDSA") return { valid: false, reason: "UNSUPPORTED_ALG" };

      const publicKey = createPublicKey(this.publicKeyPem!);
      const ok = cryptoVerify(
        null,
        Buffer.from(`${header}.${body}`),
        publicKey,
        Buffer.from(signature, "base64url")
      );
      if (!ok) return { valid: false, reason: "INVALID_SIGNATURE" };

      const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LicenseTokenClaims;
      if (claims.typ !== "license") return { valid: false, reason: "INVALID_TOKEN_TYPE" };
      if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
        return { valid: false, reason: "TOKEN_EXPIRED" };
      }

      return { valid: true, claims };
    } catch {
      return { valid: false, reason: "INVALID_TOKEN" };
    }
  }

  /** Public key dalam format PEM (untuk distribusi manual). */
  static getPublicKeyPem(): string {
    this.init();
    return this.publicKeyPem!;
  }

  /** JWKS (RFC 7517) berisi public key Ed25519. */
  static getJwks(): { keys: Record<string, string>[] } {
    this.init();
    return { keys: [this.jwkCache!] };
  }
}
