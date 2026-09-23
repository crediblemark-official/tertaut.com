import { db } from "../../db";
import { licenses, licenseActivations, licenseLeases, revokedTokens, apps } from "../../db/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { LicenseService } from "../../services/license";
import { LicenseTokenService } from "../../services/licenseToken";
import { CreditService } from "../../services/credits";
import {
  LicenseLeaseService,
  resolveFloatingConfig,
  DEFAULT_LEASE_TTL_SECONDS,
} from "../../services/licenseLease";
import { AuditService } from "../../services/audit";
import { WebhookService } from "../../services/webhooks";
import { enforceRateLimit } from "../../services/rateLimiter";
import { randomBytes } from "crypto";
import { resolveCurrentBuilder } from "../apps/builder";
import { verifyOwnedLicense } from "../../lib/ownership";
import { isVersionOlder } from "../../lib/semver";
import { getClientIp } from "../../lib/ip";

export interface DeviceActivateContext {
  body: Record<string, any>;
  set: { status?: number | string; [key: string]: any };
  request?: Request | any;
}

export interface DeviceVerifyContext {
  body: Record<string, any>;
  set: { status?: number | string; [key: string]: any };
  request?: Request | any;
}

export interface DeviceDeactivateContext {
  body: Record<string, any>;
  set: { status?: number | string; [key: string]: any };
  request?: Request | any;
}

export interface DeviceValidateContext {
  body: Record<string, any>;
  set: { status?: number | string; [key: string]: any };
  request?: Request | any;
}

export interface DeviceUnbindContext {
  body: Record<string, any>;
  set: { status?: number | string; [key: string]: any };
  request?: Request | any;
}

export interface DeviceHeartbeatContext {
  body: Record<string, any>;
  set: { status?: number | string; [key: string]: any };
  request?: Request | any;
}

export interface DeviceListSeatsContext {
  query?: Record<string, any>;
  request?: { headers?: Headers | any } | any;
  set: { status?: number | string; [key: string]: any };
}

export async function handleActivateLicense(ctx: DeviceActivateContext) {
  const { body, set, request } = ctx;
  const { licenseKey, appId, hwid, deviceName } = body;

  const rl = enforceRateLimit(request, "licensing:activate", 60, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return {
      success: false,
      error: `Terlalu banyak percobaan aktivasi. Coba lagi dalam ${rl.retryAfter} detik.`,
    };
  }

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { success: false, error: "License key not found" };
  }

  if (lic.appId !== appId) {
    set.status = 403;
    return { success: false, error: "App mismatch for this license key" };
  }

  if (lic.status !== "ACTIVE") {
    set.status = 403;
    return { success: false, error: `License is ${lic.status}` };
  }

  const now = new Date();
  if (await LicenseService.checkAndMarkExpired(lic)) {
    set.status = 403;
    return { success: false, error: "License has expired" };
  }

  const hwidHash = LicenseService.hashHardwareIdSecure(hwid);
  const lookupHashes = LicenseService.hwidLookupHashes(hwid);
  const maxSeats = lic.maxSeats || 3;
  const ipAddress = getClientIp(request);

  try {
    const outcome = await db.transaction(async (trx) => {
      // Kunci baris lisensi: mencegah balapan check-then-act melebihi kuota seat.
      const [locked] = await trx
        .select()
        .from(licenses)
        .where(eq(licenses.id, lic.id))
        .for("update");

      if (!locked || locked.status !== "ACTIVE") {
        return { error: `License is ${locked?.status || "UNKNOWN"}` };
      }

      const appRow = await trx.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
      const floating = resolveFloatingConfig(appRow);
      const leaseTtl = floating.enabled ? floating.leaseTtlSeconds : DEFAULT_LEASE_TTL_SECONDS;

      let leaseKey: string | null = null;

      // Cek apakah perangkat dengan HWID ini sudah teraktivasi sebelumnya
      const existingActivation = await trx.query.licenseActivations.findFirst({
        where: and(
          eq(licenseActivations.licenseId, lic.id),
          inArray(licenseActivations.hwidHash, lookupHashes)
        ),
      });

      if (existingActivation) {
        await trx
          .update(licenseActivations)
          .set({
            hwidHash, // migrasi transparan dari hash legacy ke salted
            lastValidatedAt: now,
            deviceName: deviceName || existingActivation.deviceName,
            ipAddress: ipAddress || existingActivation.ipAddress,
          })
          .where(eq(licenseActivations.id, existingActivation.id));

        if (
          locked.hardwareId &&
          !LicenseService.isSecureHwidHash(locked.hardwareId) &&
          lookupHashes.includes(locked.hardwareId)
        ) {
          await trx
            .update(licenses)
            .set({ hardwareId: hwidHash, updatedAt: now })
            .where(eq(licenses.id, lic.id));
        }

        // Floating: renew/create lease untuk device yang sudah dikenal.
        if (floating.enabled) {
          const { lease } = await LicenseLeaseService.acquire(lic.id, hwidHash, {
            deviceName: deviceName || existingActivation.deviceName || undefined,
            ipAddress,
            ttlSeconds: leaseTtl,
            executor: trx,
            lookupHashes,
          });
          leaseKey = lease.leaseKey;
        }
      } else {
        if (floating.enabled) {
          // Floating: kuota dihitung dari lease yang masih hidup (rolling seat).
          const liveLeases = await LicenseLeaseService.countLive(lic.id, trx);
          if (liveLeases >= maxSeats) {
            return {
              error: `Device seats quota exceeded (${liveLeases}/${maxSeats}). Please wait for another lease to expire or deactivate another device first.`,
              seatFull: true,
            };
          }

          await trx.insert(licenseActivations).values({
            id: `act_${randomBytes(8).toString("hex")}`,
            licenseId: lic.id,
            hwidHash,
            deviceName: deviceName || "Unknown Device",
            ipAddress,
            lastValidatedAt: now,
            createdAt: now,
          });

          await LicenseLeaseService.acquire(lic.id, hwidHash, {
            deviceName,
            ipAddress,
            ttlSeconds: leaseTtl,
            executor: trx,
            lookupHashes,
          }).then(({ lease }) => {
            leaseKey = lease.leaseKey;
          });

          if (!locked.hardwareId) {
            await trx
              .update(licenses)
              .set({ hardwareId: hwidHash, updatedAt: now })
              .where(eq(licenses.id, lic.id));
          }
        } else {
          const allActivations = await trx.query.licenseActivations.findMany({
            where: eq(licenseActivations.licenseId, lic.id),
          });

          if (allActivations.length >= maxSeats) {
            return {
              error: `Device seats quota exceeded (${allActivations.length}/${maxSeats}). Please deactivate another device first.`,
              seatFull: true,
            };
          }

          await trx.insert(licenseActivations).values({
            id: `act_${randomBytes(8).toString("hex")}`,
            licenseId: lic.id,
            hwidHash,
            deviceName: deviceName || "Unknown Device",
            ipAddress,
            lastValidatedAt: now,
            createdAt: now,
          });

          if (!locked.hardwareId) {
            await trx
              .update(licenses)
              .set({ hardwareId: hwidHash, updatedAt: now })
              .where(eq(licenses.id, lic.id));
          }
        }
      }

      // Rotasi token offline (Fase 5): denylist jti lama bila ada, lalu terbitkan yang baru.
      if (locked.offlineJwtGraceToken) {
        const decoded = LicenseTokenService.verify(locked.offlineJwtGraceToken);
        if (decoded.valid && decoded.claims) {
          await trx
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

      const offlineGraceDays = appRow?.deliveryConfig?.licenseKey?.offlineGraceDays;
      const licenseToken = LicenseService.createOfflineGraceToken(
        lic.licenseKey,
        lic.appId,
        hwidHash,
        lic.customerEmail,
        maxSeats,
        lic.features,
        offlineGraceDays
      );

      await trx
        .update(licenses)
        .set({
          lastValidatedAt: now,
          offlineJwtGraceToken: licenseToken,
          updatedAt: now,
        })
        .where(eq(licenses.id, lic.id));

      const seatsUsed = floating.enabled
        ? await LicenseLeaseService.countLive(lic.id, trx)
        : (
            await trx.query.licenseActivations.findMany({
              where: eq(licenseActivations.licenseId, lic.id),
            })
          ).length;

      return {
        success: true as const,
        licenseToken,
        seatsUsed,
        floating: floating.enabled,
        leaseKey,
      };
    });

    if ("error" in outcome) {
      if (outcome.seatFull) {
        await WebhookService.emit("license.seat_full", {
          license: lic,
          actorType: "CLIENT",
          actorId: hwid,
          ipAddress,
          payload: { maxSeats, deviceName },
        });
        await AuditService.record(
          "license.seat_full",
          {
            licenseId: lic.id,
            licenseKey: lic.licenseKey,
            appId: lic.appId,
            actorType: "CLIENT",
            actorId: hwid,
            ipAddress,
          },
          { maxSeats, deviceName }
        );
      }
      set.status = 403;
      return { success: false, error: outcome.error };
    }

    await AuditService.record(
      "license.activated",
      {
        licenseId: lic.id,
        licenseKey: lic.licenseKey,
        appId: lic.appId,
        actorType: "CLIENT",
        actorId: hwid,
        ipAddress,
      },
      { deviceName, seatsUsed: outcome.seatsUsed }
    );

    await WebhookService.emit("license.activated", {
      license: lic,
      actorType: "CLIENT",
      actorId: hwid,
      ipAddress,
      payload: { deviceName, seatsUsed: outcome.seatsUsed },
    });

    return {
      success: true,
      message: "Device activated successfully",
      data: {
        licenseToken: outcome.licenseToken,
        status: "ACTIVE",
        expiresAt: lic.expiresAt ? lic.expiresAt.toISOString() : null,
        seatsUsed: outcome.seatsUsed,
        maxSeats,
        floating: outcome.floating === true,
        ...(outcome.leaseKey ? { leaseKey: outcome.leaseKey } : {}),
        entitlements: lic.features || {},
        licenseVersion: lic.licenseVersion || 1,
      },
    };
  } catch (err: any) {
    // Backstop idempotensi: unique(license_id, hwid_hash) menangkap balapan insert.
    if (err?.code === "23505") {
      const activeSeats = await db.query.licenseActivations.findMany({
        where: eq(licenseActivations.licenseId, lic.id),
      });
      const appRow = await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
      const floating = resolveFloatingConfig(appRow);
      let leaseKey: string | null = null;
      if (floating.enabled) {
        const lease = await db.query.licenseLeases.findFirst({
          where: and(
            eq(licenseLeases.licenseId, lic.id),
            inArray(licenseLeases.hwidHash, lookupHashes)
          ),
        });
        leaseKey = lease?.leaseKey ?? null;
      }
      // Fix: ambil ulang token dari DB — snapshot `lic` di atas berisi token lama yang
      // baru saja di-denylist oleh transaksi pemenang balapan, sehingga verifikasi
      // offline client dengan token itu pasti gagal.
      const [freshLic] = await db
        .select({ offlineJwtGraceToken: licenses.offlineJwtGraceToken })
        .from(licenses)
        .where(eq(licenses.id, lic.id));
      return {
        success: true,
        message: "Device already activated (idempotent)",
        data: {
          licenseToken: freshLic?.offlineJwtGraceToken ?? lic.offlineJwtGraceToken,
          status: "ACTIVE",
          expiresAt: lic.expiresAt ? lic.expiresAt.toISOString() : null,
          seatsUsed: activeSeats.length,
          maxSeats,
          floating: floating.enabled,
          ...(leaseKey ? { leaseKey } : {}),
          entitlements: lic.features || {},
          licenseVersion: lic.licenseVersion || 1,
        },
      };
    }
    throw err;
  }
}

export async function handleVerifyLicense({ body, set, request }: DeviceVerifyContext) {
  const { licenseKey, hwid, appVersion } = body;

  const rl = enforceRateLimit(request, "licensing:verify", 120, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return {
      valid: false,
      status: "RATE_LIMITED",
      message: `Terlalu banyak permintaan. Coba lagi dalam ${rl.retryAfter} detik.`,
    };
  }

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { valid: false, status: "NOT_FOUND", message: "License key not found" };
  }

  if (lic.status !== "ACTIVE") {
    return { valid: false, status: lic.status, message: `License is ${lic.status}` };
  }

  const now = new Date();
  if (await LicenseService.checkAndMarkExpired(lic)) {
    return { valid: false, status: "EXPIRED", message: "License has expired" };
  }

  // Enforce version floor (Fase 1: min_version)
  if (lic.features && typeof lic.features.min_version === "string" && appVersion) {
    if (isVersionOlder(appVersion, lic.features.min_version)) {
      set.status = 403;
      return {
        valid: false,
        status: "APP_VERSION_TOO_OLD",
        reason: "APP_VERSION_TOO_OLD",
        message: `Versi aplikasi (${appVersion}) terlalu lama. Minimal versi yang didukung adalah ${lic.features.min_version}.`,
        minVersion: lic.features.min_version,
        currentVersion: appVersion,
        entitlements: lic.features || {},
      };
    }
  }

  if (hwid) {
    const lookupHashes = LicenseService.hwidLookupHashes(hwid);
    const activation = await db.query.licenseActivations.findFirst({
      where: and(
        eq(licenseActivations.licenseId, lic.id),
        inArray(licenseActivations.hwidHash, lookupHashes)
      ),
    });

    const mainBound = lic.hardwareId ? lookupHashes.includes(lic.hardwareId) : false;
    if (!activation && !mainBound) {
      return {
        valid: false,
        status: "DEVICE_NOT_ACTIVATED",
        message:
          "Perangkat ini belum teraktivasi untuk lisensi ini. Silakan aktivasi terlebih dahulu.",
      };
    }

    // Floating: perangkat harus memiliki lease yang masih hidup (rolling seat).
    const appRow = await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
    if (resolveFloatingConfig(appRow).enabled) {
      const lease = await db.query.licenseLeases.findFirst({
        where: and(
          eq(licenseLeases.licenseId, lic.id),
          inArray(licenseLeases.hwidHash, lookupHashes)
        ),
      });
      if (!lease || lease.expiresAt < now) {
        return {
          valid: false,
          status: "LEASE_STALE",
          message:
            "Lease perangkat sudah lepas karena tidak mengirim heartbeat. Silakan aktivasi ulang.",
        };
      }
    }

    if (activation) {
      await db
        .update(licenseActivations)
        .set({ lastValidatedAt: now })
        .where(eq(licenseActivations.id, activation.id));
    }
  }

  await db.update(licenses).set({ lastValidatedAt: now }).where(eq(licenses.id, lic.id));

  // Hitung sisa hari offline grace dari token tertanda (jika tersedia)
  let gracePeriodRemainingDays: number | null = null;
  if (lic.offlineJwtGraceToken) {
    const decoded = LicenseTokenService.verify(lic.offlineJwtGraceToken);
    if (decoded.valid && decoded.claims?.exp) {
      gracePeriodRemainingDays = Math.max(
        0,
        Math.ceil((decoded.claims.exp * 1000 - now.getTime()) / 86_400_000)
      );
    }
  }

  const credits = await CreditService.getBalance(lic.id);

  return {
    valid: true,
    status: "ACTIVE",
    gracePeriodRemainingDays,
    credits,
    entitlements: lic.features || {},
    licenseVersion: lic.licenseVersion || 1,
  };
}

export async function handleDeactivateLicense({ body, set, request }: DeviceDeactivateContext) {
  const { licenseKey, hwid } = body;

  const rl = enforceRateLimit(request, "licensing:deactivate", 30, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return {
      success: false,
      error: `Terlalu banyak permintaan. Coba lagi dalam ${rl.retryAfter} detik.`,
    };
  }

  if (!licenseKey || typeof licenseKey !== "string") {
    set.status = 400;
    return { success: false, error: "licenseKey wajib disertakan" };
  }

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { success: false, error: "License key not found" };
  }

  const lookupHashes = LicenseService.hwidLookupHashes(hwid);

  // Hapus seat aktivasi perangkat (mendukung hash salted maupun legacy)
  await db
    .delete(licenseActivations)
    .where(
      and(
        eq(licenseActivations.licenseId, lic.id),
        inArray(licenseActivations.hwidHash, lookupHashes)
      )
    );

  // Floating: lepaskan lease seat (rolling seat).
  await LicenseLeaseService.releaseSeat(lic.id, hwid);

  // Jika hardwareId utama sama dengan hwidHash yang di-deactivate, bersihkan
  if (lic.hardwareId && lookupHashes.includes(lic.hardwareId)) {
    const remainingAct = await db.query.licenseActivations.findFirst({
      where: eq(licenseActivations.licenseId, lic.id),
    });

    await db
      .update(licenses)
      .set({
        hardwareId: remainingAct ? remainingAct.hwidHash : null,
        updatedAt: new Date(),
      })
      .where(eq(licenses.id, lic.id));
  }

  const ipAddress = getClientIp(request);
  await AuditService.record("license.deactivated", {
    licenseId: lic.id,
    licenseKey: lic.licenseKey,
    appId: lic.appId,
    actorType: "CLIENT",
    actorId: hwid,
    ipAddress,
  });
  await WebhookService.emit("license.deactivated", {
    license: lic,
    actorType: "CLIENT",
    actorId: hwid,
    ipAddress,
    payload: { hwid },
  });

  return {
    success: true,
    message: "Device seat released successfully",
  };
}

export async function handleValidateLicense({ body, set, request }: DeviceValidateContext) {
  const { licenseKey, appId, hardwareId, appVersion, platform = "general" } = body;

  const rl = enforceRateLimit(request, "licensing:validate", 120, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { valid: false, reason: "RATE_LIMITED" };
  }

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { valid: false, reason: "LICENSE_NOT_FOUND" };
  }

  if (lic.appId !== appId) {
    set.status = 403;
    return { valid: false, reason: "APP_MISMATCH" };
  }

  if (lic.status !== "ACTIVE") {
    return { valid: false, reason: `LICENSE_${lic.status}` };
  }

  // Enforce platform bila lisensi dikunci ke platform tertentu.
  if (lic.platform && lic.platform !== "general" && platform && platform !== lic.platform) {
    return {
      valid: false,
      reason: "PLATFORM_MISMATCH",
      message: `Lisensi ini hanya berlaku untuk platform ${lic.platform}.`,
    };
  }

  const now = new Date();
  if (await LicenseService.checkAndMarkExpired(lic)) {
    return { valid: false, reason: "LICENSE_EXPIRED" };
  }

  // Enforce version floor (Fase 1: min_version)
  if (lic.features && typeof lic.features.min_version === "string" && appVersion) {
    if (isVersionOlder(appVersion, lic.features.min_version)) {
      set.status = 403;
      return {
        valid: false,
        reason: "APP_VERSION_TOO_OLD",
        message: `Versi aplikasi (${appVersion}) terlalu lama. Minimal versi yang didukung adalah ${lic.features.min_version}.`,
        minVersion: lic.features.min_version,
        currentVersion: appVersion,
        entitlements: lic.features || {},
      };
    }
  }

  // Validasi tidak boleh mengikat hardware secara implisit — binding wajib
  // melalui /activate agar kuota seat (N_active <= N_max) ditegakkan.
  let boundHardwareHash = lic.hardwareId;
  if (lic.hardwareId && !hardwareId) {
    return {
      valid: false,
      reason: "HARDWARE_ID_REQUIRED",
      message:
        "Lisensi ini sudah terikat dengan perangkat hardware. Sertakan hardwareId untuk validasi.",
    };
  }

  if (hardwareId) {
    const lookupHashes = LicenseService.hwidLookupHashes(hardwareId);
    if (lic.hardwareId && !lookupHashes.includes(lic.hardwareId)) {
      return {
        valid: false,
        reason: "HARDWARE_MISMATCH",
        message: "Lisensi ini sudah terikat dengan perangkat hardware lain.",
      };
    }
    if (!lic.hardwareId) {
      return {
        valid: false,
        reason: "DEVICE_NOT_ACTIVATED",
        message: "Perangkat belum diaktivasi. Jalankan /activate terlebih dahulu.",
      };
    }

    // Fix: lisensi floating wajib memegang lease yang masih hidup saat /validate.
    // Sebelumnya pengecekan lease hanya ada di /verify sehingga device dengan lease
    // yang sudah lepas tetap lolos validasi lewat /validate (bypass rolling seat).
    const appRowF = await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
    if (resolveFloatingConfig(appRowF).enabled) {
      const lease = await db.query.licenseLeases.findFirst({
        where: and(
          eq(licenseLeases.licenseId, lic.id),
          inArray(licenseLeases.hwidHash, lookupHashes)
        ),
      });
      if (!lease || lease.expiresAt < now) {
        return {
          valid: false,
          reason: "LEASE_STALE",
          message:
            "Lease perangkat sudah lepas karena tidak mengirim heartbeat. Silakan aktivasi ulang.",
        };
      }
    }
  }

  await db.update(licenses).set({ lastValidatedAt: now }).where(eq(licenses.id, lic.id));

  // Fase 5: rotate offline token (denylist jti lama, terbitkan yang baru).
  // Fix: gunakan SATU token hasil rotasi ini sebagai respons — sebelumnya handler
  // membuat token kedua yang tidak pernah tersimpan di DB sehingga revoke() tidak
  // bisa men-denylist token yang benar-benar dipegang client.
  const appRowV = await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
  const offlineGraceDays = appRowV?.deliveryConfig?.licenseKey?.offlineGraceDays;
  const offlineToken = await LicenseService.rotateOfflineToken(
    {
      id: lic.id,
      licenseKey: lic.licenseKey,
      appId: lic.appId,
      customerEmail: lic.customerEmail,
      maxSeats: lic.maxSeats || 3,
      features: lic.features || null,
      offlineJwtGraceToken: lic.offlineJwtGraceToken,
    },
    offlineGraceDays
  );

  return {
    valid: true,
    licenseKey: lic.licenseKey,
    status: "ACTIVE",
    expiresAt: lic.expiresAt?.toISOString() || null,
    offlineGraceToken: offlineToken,
    entitlements: lic.features || {},
    licenseVersion: lic.licenseVersion || 1,
  };
}

export async function handleUnbindHardware({ body, set, request }: DeviceUnbindContext) {
  const { licenseKey } = body;

  if (!licenseKey || typeof licenseKey !== "string") {
    set.status = 400;
    return { error: "licenseKey wajib disertakan" };
  }

  const { builder, isAdmin } = request?.headers
    ? await resolveCurrentBuilder(request.headers)
    : !request
      ? { builder: null, isAdmin: true }
      : { builder: null, isAdmin: false };

  if (!isAdmin && !builder) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  // IDOR-3: Pastikan lisensi dimiliki oleh builder
  if (!isAdmin && builder) {
    const owned = await verifyOwnedLicense(builder.id, licenseKey, isAdmin);
    if ("error" in owned) {
      set.status = owned.status;
      return { error: owned.error };
    }
  }

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { error: "License not found" };
  }

  // Hapus seluruh aktivasi perangkat + lease floating
  await db.delete(licenseActivations).where(eq(licenseActivations.licenseId, lic.id));
  await db.delete(licenseLeases).where(eq(licenseLeases.licenseId, lic.id));

  const [updated] = await db
    .update(licenses)
    .set({ hardwareId: null, updatedAt: new Date() })
    .where(eq(licenses.id, lic.id))
    .returning();

  const ipAddress = getClientIp(request);
  await AuditService.record("license.unbound", {
    licenseId: lic.id,
    licenseKey: lic.licenseKey,
    appId: lic.appId,
    actorType: "ADMIN",
    ipAddress,
  });
  await WebhookService.emit("license.unbound", {
    license: lic,
    actorType: "ADMIN",
    ipAddress,
    payload: { seatsReleased: true },
  });

  return {
    success: true,
    message: `Hardware binding & seluruh seat perangkat untuk ${licenseKey} berhasil di-reset.`,
    license: updated,
  };
}

/**
 * Fase 2 — Floating License Heartbeat.
 * Client dengan floating license wajib mengirim heartbeat berkala (mis. tiap 60 dtk)
 * dengan leaseKey yang diterima saat /activate. Lease yang tidak diperbarui akan
 * lepas otomatis dan slot seat kembali ke pool untuk device lain.
 */
export async function handleHeartbeat(ctx: DeviceHeartbeatContext) {
  const { body, set, request } = ctx;
  const { appId, licenseKey, hwid, leaseKey, deviceName } = body;

  const rl = enforceRateLimit(request, "licensing:heartbeat", 120, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return {
      success: false,
      error: `Terlalu banyak permintaan heartbeat. Coba lagi dalam ${rl.retryAfter} detik.`,
    };
  }

  if (!licenseKey || typeof licenseKey !== "string") {
    set.status = 400;
    return { success: false, error: "licenseKey wajib disertakan" };
  }

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { success: false, error: "License key not found" };
  }

  if (appId && lic.appId !== appId) {
    set.status = 403;
    return { success: false, error: "App mismatch for this license key" };
  }

  if (lic.status !== "ACTIVE") {
    set.status = 403;
    return { success: false, error: `License is ${lic.status}` };
  }

  const now = new Date();
  if (await LicenseService.checkAndMarkExpired(lic)) {
    set.status = 403;
    return { success: false, error: "License has expired" };
  }

  const appRow = await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
  const floating = resolveFloatingConfig(appRow);
  const ipAddress = getClientIp(request);

  if (floating.enabled) {
    const lease = await LicenseLeaseService.heartbeat(lic.id, hwid, leaseKey, {
      ipAddress,
      deviceName,
      ttlSeconds: floating.leaseTtlSeconds,
    });

    if (!lease) {
      set.status = 409;
      return {
        success: false,
        error:
          "Lease tidak ditemukan atau leaseKey tidak valid untuk perangkat ini. Jalankan aktivasi ulang.",
        reason: "LEASE_MISMATCH",
      };
    }

    await db.update(licenses).set({ lastValidatedAt: now }).where(eq(licenses.id, lic.id));

    const liveSeats = await LicenseLeaseService.countLive(lic.id);
    return {
      success: true,
      floating: true,
      leaseKey,
      leaseExpiresAt: lease.expiresAt.toISOString(),
      lastHeartbeatAt: lease.lastHeartbeatAt.toISOString(),
      seatsUsed: liveSeats,
      status: "ACTIVE",
    };
  }

  // Mode non-floating: heartbeat diterima sebagai keep-alive (tidak mengelola lease).
  await db.update(licenses).set({ lastValidatedAt: now }).where(eq(licenses.id, lic.id));

  return {
    success: true,
    floating: false,
    message: "Heartbeat diterima (lisensi non-floating, tidak ada lease yang dikelola).",
    status: "ACTIVE",
  };
}

/**
 * Fase 2/6 — Daftar seat & lease lisensi (dashboard, membutuhkan autentikasi).
 */
export async function handleListSeats({ query, request, set }: DeviceListSeatsContext) {
  const { licenseKey } = query || {};
  if (!licenseKey || typeof licenseKey !== "string") {
    set.status = 400;
    return { success: false, error: "licenseKey wajib disertakan" };
  }

  const { builder, isAdmin } = request?.headers
    ? await resolveCurrentBuilder(request.headers)
    : !request
      ? { builder: null, isAdmin: true }
      : { builder: null, isAdmin: false };

  if (!isAdmin && !builder) {
    set.status = 401;
    return { success: false, error: "Unauthorized" };
  }

  // IDOR-3: Pastikan lisensi dimiliki oleh builder
  if (!isAdmin && builder) {
    const owned = await verifyOwnedLicense(builder.id, licenseKey, isAdmin);
    if ("error" in owned) {
      set.status = owned.status;
      return { success: false, error: owned.error };
    }
  }

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { success: false, error: "License not found" };
  }

  const appRow = await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
  const floating = resolveFloatingConfig(appRow);

  const [activations, leases] = await Promise.all([
    db.query.licenseActivations.findMany({
      where: eq(licenseActivations.licenseId, lic.id),
      orderBy: (a, { desc }) => [desc(a.lastValidatedAt)],
    }),
    db.query.licenseLeases.findMany({
      where: eq(licenseLeases.licenseId, lic.id),
      orderBy: (l, { desc }) => [desc(l.lastHeartbeatAt)],
    }),
  ]);

  const now = new Date();
  const liveLeaseCount = leases.filter((l) => l.expiresAt > now).length;

  const seats = activations.map((act) => {
    const lease = leases.find((l) => l.hwidHash === act.hwidHash);
    const alive = Boolean(lease && lease.expiresAt > now);
    return {
      hwidHash: act.hwidHash,
      deviceName: act.deviceName,
      ipAddress: act.ipAddress,
      lastValidatedAt: act.lastValidatedAt,
      createdAt: act.createdAt,
      leaseActive: floating.enabled ? alive : null,
      leaseExpiresAt: lease?.expiresAt || null,
      lastHeartbeatAt: lease?.lastHeartbeatAt || null,
    };
  });

  return {
    success: true,
    licenseKey: lic.licenseKey,
    appId: lic.appId,
    customerEmail: lic.customerEmail,
    status: lic.status,
    floating: floating.enabled,
    maxSeats: lic.maxSeats || 3,
    seatsUsed: floating.enabled ? liveLeaseCount : activations.length,
    leaseTtlSeconds: floating.enabled ? floating.leaseTtlSeconds : null,
    seats,
  };
}
