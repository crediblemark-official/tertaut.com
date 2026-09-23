import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHmac,
  createHash,
  timingSafeEqual,
} from "crypto";
import { config } from "../config";

/**
 * Service enkripsi & keamanan tertaut.com
 * Standar NFR: AES-256-GCM untuk API Key Vault & Digital Signature untuk Token
 */
export class CryptoService {
  private static getKeyBuffer(): Buffer {
    const key = config.security.vaultEncryptionKey;
    // Pastikan key berukuran 32 bytes (256 bits)
    if (key.length === 64) {
      try {
        return Buffer.from(key, "hex");
      } catch {}
    }
    if (Buffer.byteLength(key, "utf8") === 32) {
      return Buffer.from(key, "utf8");
    }
    // Proper cryptographic derivation using SHA-256 instead of insecure padding
    return createHash("sha256").update(key).digest();
  }

  /**
   * Enkripsi string menggunakan AES-256-GCM
   */
  static encrypt(plainText: string): {
    cipherText: string;
    iv: string;
    authTag: string;
  } {
    const iv = randomBytes(12); // GCM recommended 96-bit IV
    const key = this.getKeyBuffer();
    const cipher = createCipheriv("aes-256-gcm", key, iv);

    let encrypted = cipher.update(plainText, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return {
      cipherText: encrypted,
      iv: iv.toString("hex"),
      authTag,
    };
  }

  /**
   * Dekripsi string AES-256-GCM
   */
  static decrypt(cipherText: string, ivHex: string, authTagHex: string): string {
    const key = this.getKeyBuffer();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  /**
   * Sign payload menjadi JWT terverifikasi untuk offline fallback (30 days grace period)
   */
  static createSignedToken(payload: Record<string, unknown>, expiresInSeconds = 2592000): string {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const claims = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");

    const signature = createHmac("sha256", config.security.jwtSecret)
      .update(`${header}.${claims}`)
      .digest("base64url");

    return `${header}.${claims}.${signature}`;
  }

  /**
   * Verifikasi JWT offline fallback token
   */
  static verifySignedToken<T = Record<string, unknown>>(token: string): T | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const [header, claims, signature] = parts;
      const expectedSignature = createHmac("sha256", config.security.jwtSecret)
        .update(`${header}.${claims}`)
        .digest("base64url");

      const sigBuf = Buffer.from(signature, "utf8");
      const expBuf = Buffer.from(expectedSignature, "utf8");
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(claims, "base64url").toString("utf8")) as {
        exp?: number;
      } & T;

      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null; // Expired
      }

      return payload as T;
    } catch {
      return null;
    }
  }
}
