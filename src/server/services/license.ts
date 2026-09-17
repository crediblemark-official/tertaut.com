import { randomBytes, createHash, createHmac } from "crypto";
import { LicenseTokenService } from "./licenseToken";
import { config } from "../config";

/** Prefix penanda hash HWID versi salted (HMAC). Data lama tanpa prefix = legacy. */
const HWID_SECURE_PREFIX = "hw2:";

export class LicenseService {
  /**
   * Menghasilkan format kunci lisensi: TT-XXXX-XXXX-XXXX atau TAUT-XXXX-XXXX-XXXX
   */
  static generateLicenseKey(prefix: string = "TT"): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Tanpa O, 0, 1, I untuk keterbacaan
    const segment = (len: number) => {
      let str = "";
      const bytes = randomBytes(len);
      for (let i = 0; i < len; i++) {
        str += chars[bytes[i] % chars.length];
      }
      return str;
    };

    return `${prefix}-${segment(4)}-${segment(4)}-${segment(4)}`;
  }

  /**
   * Hash hardware ID legacy (SHA-256 tanpa salt). Dipertahankan hanya untuk
   * kompatibilitas data aktivasi lama — jangan dipakai untuk binding baru.
   */
  static hashHardwareId(rawHardwareId: string): string {
    return createHash("sha256").update(rawHardwareId.trim().toLowerCase()).digest("hex");
  }

  /**
   * Hash hardware ID secara aman: HMAC-SHA256 dengan salt server (HWID_SALT/JWT_SECRET).
   * Tahan terhadap rainbow table karena hardware ID berentropi rendah.
   */
  static hashHardwareIdSecure(rawHardwareId: string): string {
    const digest = createHmac("sha256", config.security.hwidSalt)
      .update(rawHardwareId.trim().toLowerCase())
      .digest("hex");
    return `${HWID_SECURE_PREFIX}${digest}`;
  }

  static isSecureHwidHash(hash: string | null | undefined): boolean {
    return typeof hash === "string" && hash.startsWith(HWID_SECURE_PREFIX);
  }

  /**
   * Daftar kandidat hash untuk pencarian: salted lebih dulu, lalu legacy.
   * Memudahkan migrasi transparan tanpa memutus aktivasi perangkat yang sudah ada.
   */
  static hwidLookupHashes(rawHardwareId: string): string[] {
    return [
      LicenseService.hashHardwareIdSecure(rawHardwareId),
      LicenseService.hashHardwareId(rawHardwareId),
    ];
  }

  /**
   * Terbitkan 30-day offline license token bertanda tangan Ed25519 (asimetris).
   * Klien/SDK dapat memverifikasi secara lokal dengan public key tanpa shared secret.
   */
  static createOfflineGraceToken(
    licenseKey: string,
    appId: string,
    hardwareId?: string | null,
    customerEmail?: string | null,
    seats: number = 3
  ): string {
    return LicenseTokenService.sign({
      lic: licenseKey,
      app: appId,
      hw: hardwareId || null,
      eml: customerEmail || null,
      seats,
      ttlSeconds: 30 * 24 * 60 * 60, // 30 hari grace period
    });
  }
}
