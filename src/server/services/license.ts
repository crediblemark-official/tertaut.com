import { randomBytes, createHash, createHmac } from "crypto";
import { db } from "../db";
import { licenses, apps, revokedTokens } from "../db/schema";
import { eq } from "drizzle-orm";
import { LicenseTokenService } from "./licenseToken";
import { EmailService } from "./email";
import { CreditService } from "./credits";
import { AuditService } from "./audit";
import { WebhookService } from "./webhooks";
import { config } from "../config";

/** Prefix penanda hash HWID versi salted (HMAC). Data lama tanpa prefix = legacy. */
const HWID_SECURE_PREFIX = "hw2:";

/** Masa berlaku default offline grace token (hari). */
export const DEFAULT_OFFLINE_GRACE_DAYS = 30;

export interface AuditActor {
  type: "ADMIN" | "BUILDER" | "S2S" | "SYSTEM" | "CLIENT";
  id?: string;
}

export interface IssueDirectLicenseParams {
  appId: string;
  customerEmail: string;
  grantDays?: number;
  maxSeats?: number;
  platform?: "web" | "desktop" | "chrome_extension" | "android" | "general";
  grantCredits?: number;
  creditDescription?: string;
  features?: Record<string, any>;
  licenseVersion?: number;
  /** Pelaku penerbitan (untuk audit log). */
  actor?: AuditActor;
  ipAddress?: string | null;
}

export interface IssueDirectLicenseResult {
  license: typeof licenses.$inferSelect;
  creditBalance: number;
}

export interface RevokeLicenseParams {
  licenseKey?: string;
  licenseId?: string;
  actor?: AuditActor;
  ipAddress?: string | null;
}

export interface RevokeLicenseResult {
  success: boolean;
  message: string;
  tokenDenylisted: boolean;
  license?: typeof licenses.$inferSelect;
  notFound?: boolean;
}

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
   *
   * @param offlineGraceDays Masa berlaku offline token (hari). Default 30.
   */
  static createOfflineGraceToken(
    licenseKey: string,
    appId: string,
    hardwareId?: string | null,
    customerEmail?: string | null,
    seats: number = 3,
    features?: Record<string, any> | null,
    offlineGraceDays: number = DEFAULT_OFFLINE_GRACE_DAYS
  ): string {
    const vfl = typeof features?.min_version === "string" ? features.min_version : null;
    const graceDays = Math.min(
      Math.max(Number(offlineGraceDays) || DEFAULT_OFFLINE_GRACE_DAYS, 1),
      90
    );
    return LicenseTokenService.sign({
      lic: licenseKey,
      app: appId,
      hw: hardwareId || null,
      eml: customerEmail || null,
      seats,
      feat: features || null,
      vfl,
      ttlSeconds: graceDays * 24 * 60 * 60,
    });
  }

  /**
   * Rotate offline token (Fase 5): denylist jti token lama lalu terbitkan token baru.
   * Dipanggil saat validasi online / re-aktivasi agar token yang sudah beredar
   * bisa dicabut bila terjadi pencurian, dan TTL terbaru selalu dipegang device.
   */
  static async rotateOfflineToken(
    lic: {
      id: string;
      licenseKey: string;
      appId: string;
      customerEmail: string;
      maxSeats: number;
      features?: Record<string, any> | null;
      offlineJwtGraceToken?: string | null;
      hardwareId?: string | null;
    },
    offlineGraceDays: number = DEFAULT_OFFLINE_GRACE_DAYS
  ): Promise<string> {
    if (lic.offlineJwtGraceToken) {
      const decoded = LicenseTokenService.verify(lic.offlineJwtGraceToken);
      if (decoded.valid && decoded.claims) {
        await db
          .insert(revokedTokens)
          .values({
            jti: decoded.claims.jti,
            licenseId: lic.id,
            licenseKey: lic.licenseKey,
            reason: "ROTATED",
            expiresAt: decoded.claims.exp ? new Date(decoded.claims.exp * 1000) : null,
          })
          .onConflictDoNothing();
      }
    }

    const token = LicenseService.createOfflineGraceToken(
      lic.licenseKey,
      lic.appId,
      lic.hardwareId ?? null,
      lic.customerEmail,
      lic.maxSeats || 3,
      lic.features || null,
      offlineGraceDays
    );

    await db
      .update(licenses)
      .set({ offlineJwtGraceToken: token, updatedAt: new Date() })
      .where(eq(licenses.id, lic.id));

    return token;
  }

  /**
   * Terbitkan lisensi secara langsung/programatik (untuk admin panel atau S2S API).
   */
  static async issueDirect(params: IssueDirectLicenseParams): Promise<IssueDirectLicenseResult> {
    const grantDays = params.grantDays ?? 30;
    const maxSeats = params.maxSeats ?? 3;
    const platform = params.platform ?? "general";
    const grantCredits = params.grantCredits ?? 0;

    const licenseKey = LicenseService.generateLicenseKey();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + grantDays);

    const app = await db.query.apps.findFirst({ where: eq(apps.id, params.appId) });
    const features = params.features || app?.deliveryConfig?.licenseKey?.defaultFeatures || {};
    const licenseVersion = params.licenseVersion ?? 1;

    const issuedApiKey = app?.deliveryConfig?.apiAccess?.enabled
      ? `tt_cust_${randomBytes(16).toString("hex")}`
      : undefined;

    const licenseId = `lic_${randomBytes(8).toString("hex")}`;
    const offlineGraceDays = app?.deliveryConfig?.licenseKey?.offlineGraceDays;
    const offlineToken = LicenseService.createOfflineGraceToken(
      licenseKey,
      params.appId,
      null,
      params.customerEmail,
      maxSeats,
      features,
      offlineGraceDays
    );

    const [newLic] = await db
      .insert(licenses)
      .values({
        id: licenseId,
        appId: params.appId,
        licenseKey,
        customerEmail: params.customerEmail,
        platform,
        status: "ACTIVE",
        licenseVersion,
        features,
        maxSeats,
        offlineJwtGraceToken: offlineToken,
        expiresAt,
        apiKey: issuedApiKey,
      })
      .returning();

    let creditBalance = 0;
    if (grantCredits > 0) {
      creditBalance = await CreditService.grant(
        { licenseId, appId: params.appId, customerEmail: params.customerEmail },
        grantCredits,
        { description: params.creditDescription || "Penerbitan lisensi manual" }
      );
    }

    await EmailService.sendLicenseIssued({
      to: params.customerEmail,
      appName: app?.name || "Lisensi",
      licenseKey,
      expiresAt,
      deliveryDetails: app?.deliveryConfig
        ? {
            fileDownload: app.deliveryConfig.fileDownload?.enabled
              ? app.deliveryConfig.fileDownload
              : undefined,
            privateNote: app.deliveryConfig.privateNote?.enabled
              ? app.deliveryConfig.privateNote
              : undefined,
            apiAccess: app.deliveryConfig.apiAccess?.enabled
              ? { ...app.deliveryConfig.apiAccess, apiKey: issuedApiKey }
              : undefined,
          }
        : undefined,
    });

    const actor = params.actor || { type: "SYSTEM" as const };
    await AuditService.record(
      "license.issued",
      {
        licenseId: newLic.id,
        licenseKey: newLic.licenseKey,
        appId: params.appId,
        actorType: actor.type,
        actorId: actor.id,
        ipAddress: params.ipAddress,
      },
      {
        customerEmail: params.customerEmail,
        grantDays,
        maxSeats: newLic.maxSeats,
        grantCredits,
        platform: newLic.platform,
        expiresAt: expiresAt.toISOString(),
      }
    );

    await WebhookService.emit("license.issued", {
      license: newLic,
      app,
      actorType: actor.type,
      actorId: actor.id,
      ipAddress: params.ipAddress,
      payload: { customerEmail: params.customerEmail, grantDays, grantCredits, platform },
    });

    return {
      license: newLic,
      creditBalance,
    };
  }

  /**
   * Cabut lisensi (REVOKED) dan denylist token offline yang pernah diterbitkan.
   */
  static async revoke(params: RevokeLicenseParams): Promise<RevokeLicenseResult> {
    const whereClause = params.licenseId
      ? eq(licenses.id, params.licenseId)
      : params.licenseKey
        ? eq(licenses.licenseKey, params.licenseKey.trim())
        : undefined;

    if (!whereClause) {
      return {
        success: false,
        notFound: true,
        message: "License identifier missing",
        tokenDenylisted: false,
      };
    }

    const [updated] = await db
      .update(licenses)
      .set({ status: "REVOKED", updatedAt: new Date() })
      .where(whereClause)
      .returning();

    if (!updated) {
      return {
        success: false,
        notFound: true,
        message: "License not found",
        tokenDenylisted: false,
      };
    }

    let denylisted = false;
    if (updated.offlineJwtGraceToken) {
      const decoded = LicenseTokenService.verify(updated.offlineJwtGraceToken);
      if (decoded.valid && decoded.claims) {
        await db
          .insert(revokedTokens)
          .values({
            jti: decoded.claims.jti,
            licenseId: updated.id,
            licenseKey: updated.licenseKey,
            reason: "LICENSE_REVOKED",
            expiresAt: decoded.claims.exp ? new Date(decoded.claims.exp * 1000) : null,
          })
          .onConflictDoNothing();
        denylisted = true;
      }
    }

    const app = await db.query.apps.findFirst({ where: eq(apps.id, updated.appId) });
    const actor = params.actor || { type: "SYSTEM" as const };
    await AuditService.record(
      "license.revoked",
      {
        licenseId: updated.id,
        licenseKey: updated.licenseKey,
        appId: updated.appId,
        actorType: actor.type,
        actorId: actor.id,
        ipAddress: params.ipAddress,
      },
      { tokenDenylisted: denylisted }
    );
    await WebhookService.emit("license.revoked", {
      license: updated,
      app: app || null,
      actorType: actor.type,
      actorId: actor.id,
      ipAddress: params.ipAddress,
    });

    return {
      success: true,
      message: `Kunci lisensi ${updated.licenseKey} berhasil dicabut (REVOKED).`,
      tokenDenylisted: denylisted,
      license: updated,
    };
  }

  /**
   * Cek apakah lisensi sudah kedaluwarsa. Jika ya, perbarui status ke "EXPIRED" di database secara konsisten.
   */
  static async checkAndMarkExpired(
    lic: {
      id: string;
      status: string;
      expiresAt: Date | null;
      licenseKey?: string;
      appId?: string;
      customerEmail?: string | null;
    },
    dbOrTrx: any = db
  ): Promise<boolean> {
    const now = new Date();
    if (lic.status === "ACTIVE" && lic.expiresAt && lic.expiresAt < now) {
      await dbOrTrx
        .update(licenses)
        .set({ status: "EXPIRED", updatedAt: now })
        .where(eq(licenses.id, lic.id));
      lic.status = "EXPIRED";

      // BUG B2: flip EXPIRED di luar cron tidak pernah emit webhook/audit.
      // Cron (index.ts) hanya memindai baris dengan status ACTIVE, jadi begitu
      // status diubah di sini, event license.expired tidak akan pernah dilaporkan.
      try {
        const ctxLic = lic as any;
        await AuditService.record(
          "license.expired",
          {
            licenseId: ctxLic.id,
            licenseKey: ctxLic.licenseKey || null,
            appId: ctxLic.appId || null,
            actorType: "SYSTEM",
          },
          { expiresAt: now.toISOString() }
        );
        await WebhookService.emit("license.expired", {
          license: ctxLic,
          actorType: "SYSTEM",
          payload: { expiresAt: now.toISOString() },
        });
      } catch (err: any) {
        // Best-effort: jangan menggagalkan jalur verifikasi karena event gagal.
        console.error("[License] gagal emit license.expired:", err?.message || err);
      }
      return true;
    }
    return lic.status === "EXPIRED";
  }
}
