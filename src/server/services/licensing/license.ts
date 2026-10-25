import { randomBytes, createHash, createHmac } from "crypto";
import { db } from "../../db";
import { licenses, apps, revokedTokens } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { LicenseTokenService } from "./licenseToken";
import { EmailService } from "../notifications/email";
import { AuditService } from "../security/audit";
import { WebhookService } from "../notifications/webhooks";
import { config } from "../../config";

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
  features?: Record<string, any>;
  licenseVersion?: number;
  /** Pelaku penerbitan (untuk audit log). */
  actor?: AuditActor;
  ipAddress?: string | null;
}

export interface IssueDirectLicenseResult {
  license: typeof licenses.$inferSelect;
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

export interface ReactivateLicenseParams {
  licenseKey: string;
  actor?: AuditActor;
  ipAddress?: string | null;
}

export interface ReactivateLicenseResult {
  success: boolean;
  message?: string;
  error?: string;
  notFound?: boolean;
  license?: typeof licenses.$inferSelect;
}

export interface RenewLicenseParams {
  licenseKey: string;
  additionalDays?: number | string;
  days?: number | string;
  newExpiresAt?: string | null;
  isLifetime?: boolean;
  actor?: AuditActor;
  ipAddress?: string | null;
}

export interface RenewLicenseResult {
  success: boolean;
  message?: string;
  error?: string;
  notFound?: boolean;
  isLifetime?: boolean;
  newExpiry?: string | null;
  extendedDays?: number;
  additionalDays?: number;
  license?: typeof licenses.$inferSelect;
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
    offlineGraceDays: number = DEFAULT_OFFLINE_GRACE_DAYS,
    mode: "sandbox" | "live" = "live"
  ): string {
    const vfl = typeof features?.min_version === "string" ? features.min_version : null;
    const graceDays = Math.min(
      Math.max(Number(offlineGraceDays) || DEFAULT_OFFLINE_GRACE_DAYS, 1),
      90
    );
    return LicenseTokenService.sign({
      lic: licenseKey,
      app: appId,
      mode,
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
      mode?: "sandbox" | "live";
    },
    offlineGraceDays: number = DEFAULT_OFFLINE_GRACE_DAYS
  ): Promise<string> {
    if (lic.offlineJwtGraceToken) {
      const decoded = await LicenseTokenService.verify(lic.offlineJwtGraceToken);
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
      offlineGraceDays,
      lic.mode || "live"
    );

    await db
      .update(licenses)
      .set({ offlineJwtGraceToken: token, updatedAt: new Date() })
      .where(eq(licenses.id, lic.id));

    return token;
  }

  /**
   * Terbitkan atau kaitkan lisensi untuk transaksi pembayaran yang berhasil secara idempotent.
   */
  static async provisionForPayment({
    transactionId,
    appId,
    customerEmail,
    mode,
    app,
    grantDays = 365,
    now = new Date(),
    trx = db,
  }: {
    transactionId: string;
    appId: string;
    customerEmail: string;
    mode: "sandbox" | "live";
    app: any;
    grantDays?: number;
    now?: Date;
    trx?: any;
  }): Promise<{
    licenseKey: string;
    licenseId: string;
    expiresAt: Date;
    apiKey?: string;
  }> {
    const expiresAt = new Date(now.getTime() + grantDays * 24 * 60 * 60 * 1000);
    const assignedKey = (app?.deliveryConfig?.licenseKey as any)?.assignedLicenseKey;

    if (assignedKey) {
      const existing = await trx.query.licenses.findFirst({
        where: eq(licenses.licenseKey, assignedKey),
      });
      if (existing) {
        await trx
          .update(licenses)
          .set({
            transactionId,
            customerEmail,
            updatedAt: now,
          })
          .where(eq(licenses.id, existing.id));

        return {
          licenseKey: existing.licenseKey,
          licenseId: existing.id,
          expiresAt: existing.expiresAt || expiresAt,
          apiKey: existing.apiKey || undefined,
        };
      }
    }

    // Generate Universal License Key
    const licenseKey = LicenseService.generateLicenseKey();
    const maxSeats = app?.deliveryConfig?.licenseKey?.maxSeats ?? 3;
    const features = app?.deliveryConfig?.licenseKey?.defaultFeatures || {};
    const offlineGraceDays = app?.deliveryConfig?.licenseKey?.offlineGraceDays;

    const offlineToken = LicenseService.createOfflineGraceToken(
      licenseKey,
      appId,
      null,
      customerEmail,
      maxSeats,
      features,
      offlineGraceDays,
      mode
    );

    let generatedApiKey: string | undefined = undefined;
    if (app?.deliveryConfig?.apiAccess?.enabled) {
      generatedApiKey = `tt_cust_${randomBytes(16).toString("hex")}`;
    }

    const licenseId = `lic_${randomBytes(8).toString("hex")}`;
    await trx.insert(licenses).values({
      id: licenseId,
      appId,
      transactionId,
      mode,
      licenseKey,
      customerEmail,
      status: "ACTIVE",
      licenseVersion: 1,
      features,
      maxSeats,
      expiresAt,
      offlineJwtGraceToken: offlineToken,
      apiKey: generatedApiKey,
    });

    return {
      licenseKey,
      licenseId,
      expiresAt,
      apiKey: generatedApiKey,
    };
  }

  /**
   * Terbitkan lisensi secara langsung/programatik (untuk admin panel atau S2S API).
   */
  static async issueDirect(params: IssueDirectLicenseParams): Promise<IssueDirectLicenseResult> {
    const grantDays = params.grantDays ?? 30;
    const maxSeats = params.maxSeats ?? 3;
    const platform = params.platform ?? "general";

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
      offlineGraceDays,
      app?.mode || "live"
    );

    const actor = params.actor || { type: "SYSTEM" as const };
    const newLic = await db.transaction(async (trx) => {
      const [newLic] = await trx
        .insert(licenses)
        .values({
          id: licenseId,
          appId: params.appId,
          mode: app?.mode || "live",
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

      await WebhookService.emit(
        "license.issued",
        {
          license: newLic,
          app,
          actorType: actor.type,
          actorId: actor.id,
          ipAddress: params.ipAddress,
          eventId: `license.issued:${newLic.id}`,
          payload: { customerEmail: params.customerEmail, grantDays, platform },
        },
        trx
      );
      return newLic;
    });

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
        platform: newLic.platform,
        expiresAt: expiresAt.toISOString(),
      }
    );

    return {
      license: newLic,
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

    return db.transaction(async (trx) => {
      const [updated] = await trx
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
        const decoded = await LicenseTokenService.verify(updated.offlineJwtGraceToken);
        if (decoded.valid && decoded.claims) {
          await trx
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

      const app = await trx.query.apps.findFirst({ where: eq(apps.id, updated.appId) });
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
        { tokenDenylisted: denylisted },
        trx
      );
      await WebhookService.emit(
        "license.revoked",
        {
          license: updated,
          app: app || null,
          actorType: actor.type,
          actorId: actor.id,
          ipAddress: params.ipAddress,
        },
        trx
      );

      return {
        success: true,
        message: `Kunci lisensi ${updated.licenseKey} berhasil dicabut (REVOKED).`,
        tokenDenylisted: denylisted,
        license: updated,
      };
    });
  }

  static async reactivate(params: ReactivateLicenseParams): Promise<ReactivateLicenseResult> {
    const key = params.licenseKey?.trim();
    if (!key) {
      return { success: false, notFound: true, error: "licenseKey wajib disertakan" };
    }

    const lic = await db.query.licenses.findFirst({
      where: eq(licenses.licenseKey, key),
    });

    if (!lic) {
      return { success: false, notFound: true, error: "Lisensi tidak ditemukan" };
    }

    const app = await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
    const actor = params.actor || { type: "SYSTEM" as const };

    return db.transaction(async (trx) => {
      const [updated] = await trx
        .update(licenses)
        .set({ status: "ACTIVE", updatedAt: new Date() })
        .where(eq(licenses.id, lic.id))
        .returning();

      // Hapus dari revokedTokens denylist jika ada
      await trx.delete(revokedTokens).where(eq(revokedTokens.licenseId, lic.id));

      // Audit trail
      await AuditService.record(
        "license.reactivated",
        {
          licenseId: lic.id,
          licenseKey: lic.licenseKey,
          appId: lic.appId,
          actorType: actor.type,
          actorId: actor.id,
          ipAddress: params.ipAddress,
        },
        { reactivatedBy: actor.type === "ADMIN" ? "Super Admin" : "Builder" },
        trx
      );

      // Webhook
      await WebhookService.emit(
        "license.reactivated",
        {
          license: updated,
          app: app || null,
          actorType: actor.type,
          actorId: actor.id,
          ipAddress: params.ipAddress,
        },
        trx
      );

      return {
        success: true,
        message: `Lisensi ${lic.licenseKey} berhasil diaktifkan kembali (ACTIVE).`,
        license: updated,
      };
    });
  }

  static async renew(params: RenewLicenseParams): Promise<RenewLicenseResult> {
    const key = params.licenseKey?.trim();
    if (!key) {
      return { success: false, error: "licenseKey wajib disertakan" };
    }

    const lic = await db.query.licenses.findFirst({
      where: eq(licenses.licenseKey, key),
    });

    if (!lic) {
      return { success: false, notFound: true, error: "Lisensi tidak ditemukan" };
    }

    const app = await db.query.apps.findFirst({
      where: eq(apps.id, lic.appId),
    });

    const actor = params.actor || { type: "SYSTEM" as const };
    const { additionalDays, days, newExpiresAt, isLifetime } = params;

    // Kasus 1: Mengatur lisensi menjadi Permanen (Lifetime / Tanpa Expire)
    if (isLifetime || newExpiresAt === null) {
      const [updated] = await db
        .update(licenses)
        .set({
          status: "ACTIVE",
          expiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(licenses.id, lic.id))
        .returning();

      await db.delete(revokedTokens).where(eq(revokedTokens.licenseId, lic.id));

      await AuditService.record(
        "license.renewed",
        {
          licenseId: lic.id,
          licenseKey: lic.licenseKey,
          appId: lic.appId,
          actorType: actor.type,
          actorId: actor.id,
          ipAddress: params.ipAddress,
        },
        { isLifetime: true, newExpiry: null },
        db
      );

      await WebhookService.emit("license.renewed", {
        license: updated,
        app: app || null,
        actorType: actor.type,
        actorId: actor.id,
        ipAddress: params.ipAddress,
        payload: { isLifetime: true, newExpiry: null },
      });

      return {
        success: true,
        message: `Masa aktif lisensi ${key} berhasil diubah menjadi Permanen (Lifetime).`,
        newExpiry: null,
        isLifetime: true,
        license: updated,
      };
    }

    // Kasus 2: Menentukan tanggal kedaluwarsa spesifik (Custom Expiry Date)
    if (typeof newExpiresAt === "string" && newExpiresAt.trim()) {
      const targetDate = new Date(newExpiresAt.trim());
      if (isNaN(targetDate.getTime())) {
        return { success: false, error: "Format tanggal kedaluwarsa baru tidak valid." };
      }

      const newStatus = targetDate > new Date() ? "ACTIVE" : lic.status;

      const [updated] = await db
        .update(licenses)
        .set({
          status: newStatus,
          expiresAt: targetDate,
          updatedAt: new Date(),
        })
        .where(eq(licenses.id, lic.id))
        .returning();

      if (newStatus === "ACTIVE") {
        await db.delete(revokedTokens).where(eq(revokedTokens.licenseId, lic.id));
      }

      await AuditService.record(
        "license.renewed",
        {
          licenseId: lic.id,
          licenseKey: lic.licenseKey,
          appId: lic.appId,
          actorType: actor.type,
          actorId: actor.id,
          ipAddress: params.ipAddress,
        },
        { newExpiry: targetDate.toISOString() },
        db
      );

      await WebhookService.emit("license.renewed", {
        license: updated,
        app: app || null,
        actorType: actor.type,
        actorId: actor.id,
        ipAddress: params.ipAddress,
        payload: { newExpiry: targetDate.toISOString() },
      });

      return {
        success: true,
        message: `Masa aktif lisensi ${key} berhasil diubah hingga ${targetDate.toLocaleDateString("id-ID")}.`,
        newExpiry: targetDate.toISOString(),
        license: updated,
      };
    }

    // Kasus 3: Perpanjangan penambahan hari (days / additionalDays)
    let daysToAdd = Number(additionalDays || days);
    if (!daysToAdd || daysToAdd <= 0) {
      switch (app?.billingPeriod) {
        case "daily":
          daysToAdd = 1;
          break;
        case "weekly":
          daysToAdd = 7;
          break;
        case "monthly":
          daysToAdd = 30;
          break;
        case "every_3_months":
          daysToAdd = 90;
          break;
        case "every_6_months":
          daysToAdd = 180;
          break;
        case "yearly":
          daysToAdd = 365;
          break;
        default:
          daysToAdd = app?.deliveryConfig?.licenseKey?.expiresInDays || 30;
      }
    }

    // Batas maksimum perpanjangan lisensi manual oleh builder non-admin (maksimal 365 hari per request)
    if (actor.type !== "ADMIN" && daysToAdd > 365) {
      return {
        success: false,
        error:
          "Batas perpanjangan lisensi manual oleh builder dibatasi maksimum 365 hari per request.",
      };
    }

    const currentExpiry = lic.expiresAt ? new Date(lic.expiresAt) : new Date();
    const baseDate = currentExpiry.getTime() > Date.now() ? currentExpiry : new Date();
    baseDate.setDate(baseDate.getDate() + daysToAdd);

    const [updated] = await db
      .update(licenses)
      .set({
        status: "ACTIVE",
        expiresAt: baseDate,
        updatedAt: new Date(),
      })
      .where(eq(licenses.id, lic.id))
      .returning();

    await db.delete(revokedTokens).where(eq(revokedTokens.licenseId, lic.id));

    await AuditService.record(
      "license.renewed",
      {
        licenseId: lic.id,
        licenseKey: lic.licenseKey,
        appId: lic.appId,
        actorType: actor.type,
        actorId: actor.id,
        ipAddress: params.ipAddress,
      },
      { additionalDays: daysToAdd, newExpiry: baseDate.toISOString() }
    );

    await WebhookService.emit("license.renewed", {
      license: updated,
      app: app || null,
      actorType: actor.type,
      actorId: actor.id,
      ipAddress: params.ipAddress,
      payload: { additionalDays: daysToAdd, newExpiry: baseDate.toISOString() },
    });

    return {
      success: true,
      message: `Lisensi ${key} berhasil diperpanjang +${daysToAdd} hari.`,
      newExpiry: baseDate.toISOString(),
      extendedDays: daysToAdd,
      additionalDays: daysToAdd,
      license: updated,
    };
  }

  /**
   * Cek apakah lisensi sudah kedaluwarsa. Jika ya, perbarui status ke "EXPIRED" di database secara konsisten.
   * Mengembalikan true jika status berubah menjadi EXPIRED.
   * Event audit & webhook license.expired di-emit best-effort.
   */
  static async checkAndMarkExpired(
    lic: {
      id: string;
      status: string;
      expiresAt: Date | null;
      licenseKey: string;
      appId: string;
      customerEmail: string;
    },
    dbOrTrx: any = db
  ): Promise<boolean> {
    if (dbOrTrx === db) {
      return db.transaction((trx) => this.checkAndMarkExpired(lic, trx));
    }
    const now = new Date();
    if (lic.status === "ACTIVE" && lic.expiresAt && lic.expiresAt < now) {
      const changed = await dbOrTrx
        .update(licenses)
        .set({ status: "EXPIRED", updatedAt: now })
        .where(and(eq(licenses.id, lic.id), eq(licenses.status, "ACTIVE")))
        .returning();
      if (changed.length) {
        const licenseForWebhook = { ...lic, status: "EXPIRED" as const };
        await AuditService.record(
          "license.expired",
          {
            licenseId: lic.id,
            licenseKey: lic.licenseKey,
            appId: lic.appId,
            actorType: "SYSTEM",
          },
          { expiresAt: now.toISOString() },
          dbOrTrx
        );
        await WebhookService.emit(
          "license.expired",
          {
            license: licenseForWebhook,
            actorType: "SYSTEM",
            payload: { expiresAt: now.toISOString() },
          },
          dbOrTrx
        );
      }
      lic.status = "EXPIRED";
      return true;
    }
    return lic.status === "EXPIRED";
  }
}
