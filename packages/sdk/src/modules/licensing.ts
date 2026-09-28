/**
 * Modul Universal Licensing: Aktivasi, Verifikasi, Heartbeat, Floating Lease, & Smart Check.
 */

import { verifyEd25519OfflineToken } from "../utils/crypto";
import { HeartbeatLeaseError, TertautError } from "../errors";
import type {
  TertautExecutor,
  LicenseValidateOptions,
  LicenseValidateResult,
  LicenseVerifyOptions,
  LicenseVerifyResult,
  LicenseActivateOptions,
  LicenseActivateResult,
  LicenseDeactivateOptions,
  LicenseDeactivateResult,
  LicenseHeartbeatOptions,
  LicenseHeartbeatResult,
  LicenseEntitlementsResult,
  HeartbeatSessionOptions,
  HeartbeatSession,
  LicenseCheckOptions,
  LicenseCheckResult,
  OfflineTokenVerifyResult,
  OnlineOfflineTokenVerifyResult,
} from "../types";

export interface LicensingExecutor extends TertautExecutor {}

export function createFeatureHelpers(entitlements: Record<string, any> = {}) {
  return {
    hasFeature: (featureName: string): boolean =>
      Boolean(entitlements && entitlements[featureName]),
    getFeature: <T = any>(featureName: string, defaultValue?: T): T =>
      entitlements && entitlements[featureName] !== undefined
        ? entitlements[featureName]
        : (defaultValue as T),
  };
}

/** Kode lease yang menandakan seat sudah tidak lagi milik perangkat ini. */
const LEASE_LOST_CODES = new Set([
  "LEASE_MISMATCH",
  "LEASE_STALE",
  "LEASE_EXPIRED",
  "LEASE_INVALID",
]);

export class LicensingModule {
  constructor(private ctx: LicensingExecutor) {}

  public async validate(options: LicenseValidateOptions): Promise<LicenseValidateResult> {
    return this.ctx.requestJson<LicenseValidateResult>("/api/v1/licensing/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: options.licenseKey,
        appId: this.ctx.appId,
        hardwareId: options.hardwareId,
        appVersion: options.appVersion,
        platform: options.platform,
      }),
    });
  }

  public async verify(options: LicenseVerifyOptions): Promise<LicenseVerifyResult> {
    return this.ctx.requestJson<LicenseVerifyResult>("/api/v1/licensing/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: options.licenseKey,
        hwid: options.hwid,
        appVersion: options.appVersion,
      }),
    });
  }

  public async entitlements(options: {
    licenseKey: string;
    hwid?: string;
    appVersion?: string;
  }): Promise<LicenseEntitlementsResult> {
    const data = await this.ctx.requestJson<any>("/api/v1/licensing/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: options.licenseKey,
        hwid: options.hwid,
        appVersion: options.appVersion,
      }),
    });
    const feats = (data.entitlements || {}) as Record<string, any>;
    const helpers = createFeatureHelpers(feats);
    return {
      valid: Boolean(data.valid),
      entitlements: feats,
      licenseVersion: (data.licenseVersion || 1) as number,
      status: data.status,
      reason: data.reason,
      message: data.message,
      hasFeature: helpers.hasFeature,
      getFeature: helpers.getFeature,
    };
  }

  public async activate(options: LicenseActivateOptions): Promise<LicenseActivateResult> {
    return this.ctx.requestJson<LicenseActivateResult>("/api/v1/licensing/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: this.ctx.appId,
        licenseKey: options.licenseKey,
        hwid: options.hwid,
        deviceName: options.deviceName || "UserDevice",
      }),
    });
  }

  public async deactivate(options: LicenseDeactivateOptions): Promise<LicenseDeactivateResult> {
    return this.ctx.requestJson<LicenseDeactivateResult>("/api/v1/licensing/deactivate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: options.licenseKey,
        hwid: options.hwid,
      }),
    });
  }

  public async heartbeat(options: LicenseHeartbeatOptions): Promise<LicenseHeartbeatResult> {
    const res = await this.ctx.requestJson<any>("/api/v1/licensing/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: this.ctx.appId || undefined,
        licenseKey: options.licenseKey,
        hwid: options.hwid,
        leaseKey: options.leaseKey,
        deviceName: options.deviceName,
      }),
    });

    // Server mengirim `leaseExpiresAt`; normalisasi ke `expiresAt` agar konsumen
    // lama yang membaca `expiresAt` tetap bekerja.
    return res?.success ? { ...res, expiresAt: res.expiresAt ?? res.leaseExpiresAt } : res;
  }

  public startHeartbeatSession(options: HeartbeatSessionOptions): HeartbeatSession {
    let currentLeaseKey = options.leaseKey;
    let active = true;
    const intervalMs = (options.intervalSeconds || 60) * 1000;

    /** Seat yang hilang berarti loop harus berhenti, bukan error selamanya. */
    const handleFailure = (err: any) => {
      const code = err instanceof TertautError ? err.code : undefined;
      if (err instanceof HeartbeatLeaseError || (code && LEASE_LOST_CODES.has(code))) {
        active = false;
        options.onLeaseExpired?.(err);
      }
      options.onError?.(err);
    };

    const beat = async (): Promise<LicenseHeartbeatResult> => {
      if (!active) throw new Error("Heartbeat session has stopped");

      let res: LicenseHeartbeatResult;
      try {
        res = await this.heartbeat({
          licenseKey: options.licenseKey,
          hwid: options.hwid,
          leaseKey: currentLeaseKey,
          deviceName: options.deviceName,
        });
      } catch (err: any) {
        // `requestJson` sudah melempar error bertipe untuk status >= 400
        // (lease hilang dibalas 409 + `reason: "LEASE_MISMATCH"`).
        handleFailure(err);
        throw err;
      }

      // Toleransi: endpoint yang dibungkus proxy dapat membalas 200 dengan
      // `success:false`. Perlakukan sama supaya loop tetap berhenti.
      if (res?.success === false) {
        const err = new HeartbeatLeaseError(
          res.error || "Heartbeat failed",
          res.reason || res.errorCode || "LEASE_EXPIRED"
        );
        handleFailure(err);
        throw err;
      }

      options.onSuccess?.(res);
      return res;
    };

    const timer = setInterval(() => {
      if (active) {
        beat().catch(() => {});
      } else {
        clearInterval(timer);
      }
    }, intervalMs);

    return {
      stop: () => {
        active = false;
        clearInterval(timer);
      },
      getLeaseKey: () => currentLeaseKey,
      isActive: () => active,
      beatNow: beat,
    };
  }

  public async check(options: LicenseCheckOptions): Promise<LicenseCheckResult> {
    const fallback = options.allowOfflineFallback !== false;

    // 1. Coba validasi online ke server
    try {
      const onlineRes = await this.validate({
        licenseKey: options.licenseKey,
        hardwareId: options.hwid,
        appVersion: options.appVersion,
        platform: options.platform,
      });

      if (onlineRes && typeof onlineRes.valid === "boolean") {
        const feats = onlineRes.entitlements || {};
        const helpers = createFeatureHelpers(feats);
        return {
          valid: onlineRes.valid,
          source: "online",
          status: onlineRes.status,
          expiresAt: onlineRes.expiresAt,
          entitlements: feats,
          licenseVersion: onlineRes.licenseVersion || 1,
          reason: onlineRes.reason,
          message: onlineRes.message,
          hasFeature: helpers.hasFeature,
          getFeature: helpers.getFeature,
        };
      }
    } catch (err: any) {
      if (!fallback) {
        throw err;
      }
    }

    // 2. Fallback ke verifikasi token offline jika ada
    if (options.offlineToken) {
      const off = await this.verifyOfflineToken(options.offlineToken, {
        publicKeyJwk: options.publicKeyJwk,
        appVersion: options.appVersion,
      });

      const feats = (off.claims?.feat || {}) as Record<string, any>;
      const helpers = createFeatureHelpers(feats);
      const expIso = off.claims?.exp ? new Date(off.claims.exp * 1000).toISOString() : null;

      return {
        valid: off.valid,
        source: "offline",
        status: off.valid ? "ACTIVE" : "INVALID",
        expiresAt: expIso,
        entitlements: feats,
        licenseVersion: 1,
        reason: off.reason,
        hasFeature: helpers.hasFeature,
        getFeature: helpers.getFeature,
      };
    }

    const emptyHelpers = createFeatureHelpers({});
    return {
      valid: false,
      source: "offline",
      status: "UNAVAILABLE",
      expiresAt: null,
      entitlements: {},
      licenseVersion: 1,
      reason: "SERVER_UNREACHABLE_NO_OFFLINE_TOKEN",
      hasFeature: emptyHelpers.hasFeature,
      getFeature: emptyHelpers.getFeature,
    };
  }

  public async getJwks(): Promise<{ keys: JsonWebKey[] }> {
    return this.ctx.requestJson("/.well-known/jwks.json");
  }

  /**
   * Verifikasi offline token secara lokal (Ed25519 / Web Crypto).
   * Tidak menghubungi server, sehingga tidak bisa mendeteksi revoke terbaru.
   */
  public async verifyOfflineToken(
    token: string,
    options?: { publicKeyJwk?: JsonWebKey; jwksUrl?: string; appVersion?: string }
  ): Promise<OfflineTokenVerifyResult> {
    return verifyEd25519OfflineToken(token, {
      baseUrl: this.ctx.baseUrl,
      ...options,
    });
  }

  /**
   * Verifikasi offline token secara online. Tidak seperti `verifyOfflineToken`,
   * endpoint ini mengecek JTI denylist dan status lisensi terkini di server,
   * sehingga dapat menangkap token yang sudah dicabut.
   */
  public async verifyOfflineTokenOnline(token: string): Promise<OnlineOfflineTokenVerifyResult> {
    return this.ctx.requestJson<OnlineOfflineTokenVerifyResult>(
      "/api/v1/licensing/verify-offline-token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }
    );
  }

  public hasFeature(entitlements: Record<string, any>, featureName: string): boolean {
    return Boolean(entitlements && entitlements[featureName]);
  }

  public getFeature<T = any>(
    entitlements: Record<string, any>,
    featureName: string,
    defaultValue?: T
  ): T {
    return entitlements && entitlements[featureName] !== undefined
      ? entitlements[featureName]
      : (defaultValue as T);
  }

  /**
   * Verifikasi customer API key yang diterbitkan otomatis saat checkout.
   */
  public async verifyApiKey(apiKey: string): Promise<any> {
    return this.ctx.requestJson("/api/v1/licensing/api-key/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
  }
}
