import { db } from "../../../db";
import {
  licenses,
  licenseActivations,
  licenseLeases,
  revokedTokens,
  apps,
} from "../../../db/schema";
import { eq, and, inArray, gt } from "drizzle-orm";
import { LicenseService } from "../../../services/licensing/license";
import { LicenseTokenService } from "../../../services/licensing/licenseToken";
import {
  LicenseLeaseService,
  resolveFloatingConfig,
  DEFAULT_LEASE_TTL_SECONDS,
} from "../../../services/licensing/licenseLease";
import { AuditService } from "../../../services/security/audit";
import { WebhookService } from "../../../services/notifications/webhooks";
import { enforceRateLimit } from "../../../services/security/rateLimiter";
import { randomBytes } from "crypto";
import { getClientIp } from "../../../lib/ip";
import type { DeviceActivateContext } from "./types";

export async function handleActivateLicense(ctx: DeviceActivateContext) {
  const { body, set, request } = ctx;
  const { licenseKey, appId, hwid, deviceName } = body;

  const rl = enforceRateLimit(request, "licensing:activate", 60, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return {
      success: false,
      error: `Terlalu banyak percobaan aktivasi. Coba lagi dalam ${rl.retryAfter} detik.`,
      errorCode: "RATE_LIMITED",
      retryAfter: rl.retryAfter,
    };
  }

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return {
      success: false,
      error: "License key not found",
      errorCode: "LICENSE_NOT_FOUND",
    };
  }

  if (lic.appId !== appId) {
    set.status = 403;
    return {
      success: false,
      error: "App mismatch for this license key",
      errorCode: "APP_MISMATCH",
    };
  }

  if (lic.status !== "ACTIVE") {
    set.status = 403;
    return {
      success: false,
      error: `License is ${lic.status}`,
      errorCode: `LICENSE_${lic.status}`,
    };
  }

  const now = new Date();
  if (await LicenseService.checkAndMarkExpired(lic)) {
    set.status = 403;
    return {
      success: false,
      error: "License has expired",
      errorCode: "LICENSE_EXPIRED",
    };
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
          const hasLiveLease = await trx.query.licenseLeases.findFirst({
            where: and(
              eq(licenseLeases.licenseId, lic.id),
              inArray(licenseLeases.hwidHash, lookupHashes),
              gt(licenseLeases.expiresAt, now)
            ),
          });

          if (!hasLiveLease) {
            const liveLeases = await LicenseLeaseService.countLive(lic.id, trx);
            if (liveLeases >= maxSeats) {
              return {
                error: `Device seats quota exceeded (${liveLeases}/${maxSeats}). Please wait for another lease to expire or deactivate another device first.`,
                seatFull: true,
              };
            }
          }

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
      return {
        success: false,
        error: outcome.error,
        ...(outcome.seatFull ? { errorCode: "SEAT_FULL" } : {}),
      };
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

    const floatingConfig = resolveFloatingConfig(
      await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) })
    );

    return {
      success: true,
      message: "Device activated successfully",
      activated: true,
      data: {
        licenseToken: outcome.licenseToken,
        status: "ACTIVE",
        expiresAt: lic.expiresAt ? lic.expiresAt.toISOString() : null,
        seatsUsed: outcome.seatsUsed,
        maxSeats,
        floating: outcome.floating === true,
        ...(outcome.leaseKey ? { leaseKey: outcome.leaseKey } : {}),
        ...(outcome.floating === true
          ? {
              leaseTtlSeconds: floatingConfig.leaseTtlSeconds,
              heartbeatIntervalSeconds: floatingConfig.heartbeatIntervalSeconds,
            }
          : {}),
        entitlements: lic.features || {},
        licenseVersion: lic.licenseVersion || 1,
      },
    };
  } catch (err: any) {
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
          ...(floating.enabled
            ? {
                leaseTtlSeconds: floating.leaseTtlSeconds,
                heartbeatIntervalSeconds: floating.heartbeatIntervalSeconds,
              }
            : {}),
          entitlements: lic.features || {},
          licenseVersion: lic.licenseVersion || 1,
        },
      };
    }
    throw err;
  }
}
