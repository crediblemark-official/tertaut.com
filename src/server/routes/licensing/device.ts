import { db } from "../../db";
import { licenses, licenseActivations } from "../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { LicenseService } from "../../services/license";
import { LicenseTokenService } from "../../services/licenseToken";
import { CreditService } from "../../services/credits";
import { enforceRateLimit } from "../../services/rateLimiter";
import { randomBytes } from "crypto";

export async function handleActivateLicense(ctx: any) {
  const { body, set, request } = ctx;
  const { licenseKey, appId, hwid, deviceName } = body;

  const rl = enforceRateLimit(request, "licensing:activate", 60, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { success: false, error: `Terlalu banyak percobaan aktivasi. Coba lagi dalam ${rl.retryAfter} detik.` };
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
  if (lic.expiresAt && lic.expiresAt < now) {
    await db
      .update(licenses)
      .set({ status: "EXPIRED", updatedAt: now })
      .where(eq(licenses.id, lic.id));

    set.status = 403;
    return { success: false, error: "License has expired" };
  }

  const hwidHash = LicenseService.hashHardwareIdSecure(hwid);
  const lookupHashes = LicenseService.hwidLookupHashes(hwid);
  const maxSeats = lic.maxSeats || 3;
  const ipAddress =
    request?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
    request?.headers?.get?.("x-real-ip") ||
    null;

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
      } else {
        const allActivations = await trx.query.licenseActivations.findMany({
          where: eq(licenseActivations.licenseId, lic.id),
        });

        if (allActivations.length >= maxSeats) {
          return {
            error: `Device seats quota exceeded (${allActivations.length}/${maxSeats}). Please deactivate another device first.`,
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

      const activeSeats = await trx.query.licenseActivations.findMany({
        where: eq(licenseActivations.licenseId, lic.id),
      });

      // Hasilkan Signed License JWT Token (dengan 30 days offline grace period)
      const licenseToken = LicenseService.createOfflineGraceToken(
        lic.licenseKey,
        lic.appId,
        hwidHash,
        lic.customerEmail,
        maxSeats
      );

      await trx
        .update(licenses)
        .set({
          lastValidatedAt: now,
          offlineJwtGraceToken: licenseToken,
          updatedAt: now,
        })
        .where(eq(licenses.id, lic.id));

      return { success: true as const, licenseToken, seatsUsed: activeSeats.length };
    });

    if ("error" in outcome) {
      set.status = 403;
      return { success: false, error: outcome.error };
    }

    return {
      success: true,
      message: "Device activated successfully",
      data: {
        licenseToken: outcome.licenseToken,
        status: "ACTIVE",
        expiresAt: lic.expiresAt ? lic.expiresAt.toISOString() : null,
        seatsUsed: outcome.seatsUsed,
        maxSeats,
      },
    };
  } catch (err: any) {
    // Backstop idempotensi: unique(license_id, hwid_hash) menangkap balapan insert.
    if (err?.code === "23505") {
      const activeSeats = await db.query.licenseActivations.findMany({
        where: eq(licenseActivations.licenseId, lic.id),
      });
      return {
        success: true,
        message: "Device already activated (idempotent)",
        data: {
          licenseToken: lic.offlineJwtGraceToken,
          status: "ACTIVE",
          expiresAt: lic.expiresAt ? lic.expiresAt.toISOString() : null,
          seatsUsed: activeSeats.length,
          maxSeats,
        },
      };
    }
    throw err;
  }
}

export async function handleVerifyLicense({ body, set, request }: any) {
  const { licenseKey, hwid } = body;

  const rl = enforceRateLimit(request, "licensing:verify", 120, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { valid: false, status: "RATE_LIMITED", message: `Terlalu banyak permintaan. Coba lagi dalam ${rl.retryAfter} detik.` };
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
  if (lic.expiresAt && lic.expiresAt < now) {
    await db
      .update(licenses)
      .set({ status: "EXPIRED", updatedAt: now })
      .where(eq(licenses.id, lic.id));

    return { valid: false, status: "EXPIRED", message: "License has expired" };
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
        message: "Perangkat ini belum teraktivasi untuk lisensi ini. Silakan aktivasi terlebih dahulu.",
      };
    }

    if (activation) {
      await db
        .update(licenseActivations)
        .set({ lastValidatedAt: now })
        .where(eq(licenseActivations.id, activation.id));
    }
  }

  await db
    .update(licenses)
    .set({ lastValidatedAt: now })
    .where(eq(licenses.id, lic.id));

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
  };
}

export async function handleDeactivateLicense({ body, set, request }: any) {
  const { licenseKey, hwid } = body;

  const rl = enforceRateLimit(request, "licensing:deactivate", 30, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${rl.retryAfter} detik.` };
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

  return {
    success: true,
    message: "Device seat released successfully",
  };
}

export async function handleValidateLicense({ body, set, request }: any) {
  const { licenseKey, appId, hardwareId, platform = "general" } = body;

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
  if (lic.expiresAt && lic.expiresAt < now) {
    await db
      .update(licenses)
      .set({ status: "EXPIRED", updatedAt: now })
      .where(eq(licenses.id, lic.id));

    return { valid: false, reason: "LICENSE_EXPIRED" };
  }

  // Validasi tidak boleh mengikat hardware secara implisit — binding wajib
  // melalui /activate agar kuota seat (N_active <= N_max) ditegakkan.
  let boundHardwareHash = lic.hardwareId;
  if (lic.hardwareId && !hardwareId) {
    return {
      valid: false,
      reason: "HARDWARE_ID_REQUIRED",
      message: "Lisensi ini sudah terikat dengan perangkat hardware. Sertakan hardwareId untuk validasi.",
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
  }

  await db
    .update(licenses)
    .set({ lastValidatedAt: now })
    .where(eq(licenses.id, lic.id));

  const offlineToken = LicenseService.createOfflineGraceToken(
    lic.licenseKey,
    lic.appId,
    boundHardwareHash,
    lic.customerEmail,
    lic.maxSeats || 3
  );

  return {
    valid: true,
    licenseKey: lic.licenseKey,
    status: "ACTIVE",
    expiresAt: lic.expiresAt?.toISOString() || null,
    offlineGraceToken: offlineToken,
  };
}

export async function handleUnbindHardware({ body, set }: any) {
  const { licenseKey } = body;

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { error: "License not found" };
  }

  // Hapus seluruh aktivasi perangkat
  await db
    .delete(licenseActivations)
    .where(eq(licenseActivations.licenseId, lic.id));

  const [updated] = await db
    .update(licenses)
    .set({ hardwareId: null, updatedAt: new Date() })
    .where(eq(licenses.id, lic.id))
    .returning();

  return {
    success: true,
    message: `Hardware binding & seluruh seat perangkat untuk ${licenseKey} berhasil di-reset.`,
    license: updated,
  };
}
