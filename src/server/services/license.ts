import { randomBytes, createHash } from "crypto";
import { CryptoService } from "./crypto";

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
   * Hash hardware ID (CPU ID + Motherboard UUID) untuk pengikatan lisensi desktop
   */
  static hashHardwareId(rawHardwareId: string): string {
    return createHash("sha256").update(rawHardwareId.trim().toLowerCase()).digest("hex");
  }

  /**
   * Terbitkan 30-day offline JWT fallback token bertanda tangan kriptografis
   */
  static createOfflineGraceToken(
    licenseKey: string,
    appId: string,
    hardwareId?: string | null,
    customerEmail?: string | null,
    seats: number = 3
  ): string {
    return CryptoService.createSignedToken(
      {
        sub: licenseKey,
        lic: licenseKey,
        appId,
        app: appId,
        eml: customerEmail || null,
        seats,
        hw: hardwareId || null,
        type: "offline_grace_license",
      },
      30 * 24 * 60 * 60 // 30 hari grace period
    );
  }
}
