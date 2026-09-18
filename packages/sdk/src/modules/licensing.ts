/**
 * Modul Universal Licensing: Aktivasi, Verifikasi, Heartbeat, Floating Lease, & Smart Check.
 */

import { verifyEd25519OfflineToken } from "../utils/crypto";
import type {
  LicenseValidateOptions,
  LicenseValidateResult,
  LicenseVerifyOptions,
  LicenseVerifyResult,
  LicenseActivateOptions,
  LicenseActivateResult,
  LicenseDeactivateOptions,
  LicenseHeartbeatOptions,
  LicenseHeartbeatResult,
  LicenseEntitlementsResult,
  HeartbeatSessionOptions,
  HeartbeatSession,
  LicenseCheckOptions,
  LicenseCheckResult,
  OfflineTokenVerifyResult,
} from "../types";

export interface LicensingExecutor {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  appId: string;
  baseUrl: string;
}

export function createFeatureHelpers(entitlements: Record<string, any> = {}) {
  return {
    hasFeature: (featureName: string): boolean => Boolean(entitlements && entitlements[featureName]),
    getFeature: <T = any>(featureName: string, defaultValue?: T): T =>
      entitlements && entitlements[featureName] !== undefined
        ? entitlements[featureName]
        : (defaultValue as T),
  };
}

export class LicensingModule {
  constructor(private ctx: LicensingExecutor) {}

  public async validate(options: LicenseValidateOptions): Promise<LicenseValidateResult> {
    const res = await this.ctx.request("/api/v1/licensing/validate", {
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
    return res.json();
  }

  public async verify(options: LicenseVerifyOptions): Promise<LicenseVerifyResult> {
    const res = await this.ctx.request("/api/v1/licensing/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: options.licenseKey,
        hwid: options.hwid,
        appVersion: options.appVersion,
      }),
    });
    return res.json();
  }

  public async entitlements(options: {
    licenseKey: string;
    hwid?: string;
    appVersion?: string;
  }): Promise<LicenseEntitlementsResult> {
    const res = await this.ctx.request("/api/v1/licensing/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: options.licenseKey,
        hwid: options.hwid,
        appVersion: options.appVersion,
      }),
    });
    const data = await res.json();
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
    const res = await this.ctx.request("/api/v1/licensing/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: this.ctx.appId,
        licenseKey: options.licenseKey,
        hwid: options.hwid,
        deviceName: options.deviceName || "UserDevice",
      }),
    });
    return res.json();
  }

  public async deactivate(options: LicenseDeactivateOptions): Promise<{ success: boolean; deactivated?: boolean }> {
    const res = await this.ctx.request("/api/v1/licensing/deactivate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: options.licenseKey,
        hwid: options.hwid,
      }),
    });
    return res.json();
  }

  public async heartbeat(options: LicenseHeartbeatOptions): Promise<LicenseHeartbeatResult> {
    const res = await this.ctx.request("/api/v1/licensing/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: this.ctx.appId,
        licenseKey: options.licenseKey,
        hwid: options.hwid,
        leaseKey: options.leaseKey,
        deviceName: options.deviceName,
      }),
    });
    return res.json();
  }

  public startHeartbeatSession(options: HeartbeatSessionOptions): HeartbeatSession {
    let currentLeaseKey = options.leaseKey;
    let active = true;
    const intervalMs = (options.intervalSeconds || 60) * 1000;

    const beat = async (): Promise<LicenseHeartbeatResult> => {
      if (!active) throw new Error("Heartbeat session has stopped");
      try {
        const res = await this.heartbeat({
          licenseKey: options.licenseKey,
          hwid: options.hwid,
          leaseKey: currentLeaseKey,
          deviceName: options.deviceName,
        });

        if (!res.success) {
          const err = new Error(res.error || "Heartbeat failed");
          if (res.errorCode === "LEASE_EXPIRED" || res.errorCode === "LEASE_INVALID") {
            active = false;
            options.onLeaseExpired?.(err);
          }
          options.onError?.(err);
          return res;
        }

        options.onSuccess?.(res);
        return res;
      } catch (err: any) {
        options.onError?.(err);
        throw err;
      }
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
          seatsUsed: onlineRes.seatsUsed,
          maxSeats: onlineRes.maxSeats,
          token: onlineRes.licenseToken,
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
        token: options.offlineToken,
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
    const res = await this.ctx.request("/.well-known/jwks.json");
    return res.json();
  }

  public async verifyOfflineToken(
    token: string,
    options?: { publicKeyJwk?: JsonWebKey; jwksUrl?: string; appVersion?: string }
  ): Promise<OfflineTokenVerifyResult> {
    return verifyEd25519OfflineToken(token, {
      baseUrl: this.ctx.baseUrl,
      ...options,
    });
  }

  public hasFeature(entitlements: Record<string, any>, featureName: string): boolean {
    return Boolean(entitlements && entitlements[featureName]);
  }

  public getFeature<T = any>(entitlements: Record<string, any>, featureName: string, defaultValue?: T): T {
    return entitlements && entitlements[featureName] !== undefined
      ? entitlements[featureName]
      : (defaultValue as T);
  }
}
