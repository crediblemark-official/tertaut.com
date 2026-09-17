import { Elysia, t } from "elysia";
import { db } from "../db";
import { licenses, licenseActivations, apps } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { LicenseService } from "../services/license";
import { CryptoService } from "../services/crypto";
import { randomBytes } from "crypto";

// Common handler implementations for dual-route mounting (/licensing & /license)
async function handleActivateLicense({ body, set }: any) {
  const { licenseKey, appId, hwid, deviceName } = body;

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

  const hwidHash = LicenseService.hashHardwareId(hwid);
  const maxSeats = lic.maxSeats || 3;

  // Cek apakah perangkat dengan HWID ini sudah teraktivasi sebelumnya
  const existingActivation = await db.query.licenseActivations.findFirst({
    where: and(
      eq(licenseActivations.licenseId, lic.id),
      eq(licenseActivations.hwidHash, hwidHash)
    ),
  });

  if (existingActivation) {
    // Update last validated timestamp & optional device name
    await db
      .update(licenseActivations)
      .set({
        lastValidatedAt: now,
        deviceName: deviceName || existingActivation.deviceName,
      })
      .where(eq(licenseActivations.id, existingActivation.id));
  } else {
    // Periksa kuota device seat
    const allActivations = await db.query.licenseActivations.findMany({
      where: eq(licenseActivations.licenseId, lic.id),
    });

    if (allActivations.length >= maxSeats) {
      set.status = 403;
      return {
        success: false,
        error: `Device seats quota exceeded (${allActivations.length}/${maxSeats}). Please deactivate another device first.`,
      };
    }

    // Daftarkan seat perangkat baru
    const actId = `act_${randomBytes(8).toString("hex")}`;
    await db.insert(licenseActivations).values({
      id: actId,
      licenseId: lic.id,
      hwidHash,
      deviceName: deviceName || "Unknown Device",
      lastValidatedAt: now,
      createdAt: now,
    });

    if (!lic.hardwareId) {
      await db
        .update(licenses)
        .set({ hardwareId: hwidHash, lastValidatedAt: now, updatedAt: now })
        .where(eq(licenses.id, lic.id));
    }
  }

  // Hitung jumlah seat terpakai saat ini
  const activeSeats = await db.query.licenseActivations.findMany({
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

  await db
    .update(licenses)
    .set({
      lastValidatedAt: now,
      offlineJwtGraceToken: licenseToken,
      updatedAt: now,
    })
    .where(eq(licenses.id, lic.id));

  return {
    success: true,
    message: "Device activated successfully",
    data: {
      licenseToken,
      status: "ACTIVE",
      expiresAt: lic.expiresAt ? lic.expiresAt.toISOString() : null,
      seatsUsed: activeSeats.length,
      maxSeats,
    },
  };
}

async function handleVerifyLicense({ body, set }: any) {
  const { licenseKey, hwid } = body;

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
    const hwidHash = LicenseService.hashHardwareId(hwid);
    const activation = await db.query.licenseActivations.findFirst({
      where: and(
        eq(licenseActivations.licenseId, lic.id),
        eq(licenseActivations.hwidHash, hwidHash)
      ),
    });

    if (!activation && lic.hardwareId !== hwidHash) {
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
    const decoded = CryptoService.verifySignedToken<{ exp?: number }>(lic.offlineJwtGraceToken);
    if (decoded?.exp) {
      gracePeriodRemainingDays = Math.max(
        0,
        Math.ceil((decoded.exp * 1000 - now.getTime()) / 86_400_000)
      );
    }
  }

  return {
    valid: true,
    status: "ACTIVE",
    gracePeriodRemainingDays,
  };
}

async function handleDeactivateLicense({ body, set }: any) {
  const { licenseKey, hwid } = body;

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { success: false, error: "License key not found" };
  }

  const hwidHash = LicenseService.hashHardwareId(hwid);

  // Hapus seat aktivasi perangkat
  await db
    .delete(licenseActivations)
    .where(
      and(
        eq(licenseActivations.licenseId, lic.id),
        eq(licenseActivations.hwidHash, hwidHash)
      )
    );

  // Jika hardwareId utama sama dengan hwidHash yang di-deactivate, bersihkan
  if (lic.hardwareId === hwidHash) {
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

// Router factory to mount both /licensing and /license
function createLicensingRouter(prefix: string) {
  return new Elysia({ prefix })
    /**
     * PRD 7.1 A: Activate License & Bind Device Seat
     */
    .post(
      "/activate",
      handleActivateLicense,
      {
        body: t.Object({
          licenseKey: t.String(),
          appId: t.String(),
          hwid: t.String(),
          deviceName: t.Optional(t.String()),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "Activate License & Bind Device Seat",
          description: "Binds hardware device to license seat within N_active <= N_max quota and returns signed offline JWT token",
        },
      }
    )

    /**
     * PRD 7.1 B: Validate / Verify License (Online Check)
     */
    .post(
      "/verify",
      handleVerifyLicense,
      {
        body: t.Object({
          licenseKey: t.String(),
          hwid: t.Optional(t.String()),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "Validate License (Online Check)",
          description: "Verifies license validity and device seat assignment (< 50ms)",
        },
      }
    )

    /**
     * PRD 7.1 C: Deactivate / Unlink Device Seat
     */
    .post(
      "/deactivate",
      handleDeactivateLicense,
      {
        body: t.Object({
          licenseKey: t.String(),
          hwid: t.String(),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "Deactivate / Unlink Device Seat",
          description: "Releases a device seat for reuse on another machine",
        },
      }
    )

    /**
     * Legacy / SDK Generic License Validation
     */
    .post(
      "/validate",
      async ({ body, set }) => {
        const { licenseKey, appId, hardwareId, platform = "general" } = body;

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

        const now = new Date();
        if (lic.expiresAt && lic.expiresAt < now) {
          await db
            .update(licenses)
            .set({ status: "EXPIRED", updatedAt: now })
            .where(eq(licenses.id, lic.id));

          return { valid: false, reason: "LICENSE_EXPIRED" };
        }

        let boundHardwareHash = lic.hardwareId;
        if (hardwareId) {
          const incomingHash = LicenseService.hashHardwareId(hardwareId);
          if (!lic.hardwareId) {
            boundHardwareHash = incomingHash;
            await db
              .update(licenses)
              .set({
                hardwareId: incomingHash,
                platform,
                lastValidatedAt: now,
                updatedAt: now,
              })
              .where(eq(licenses.id, lic.id));
          } else if (lic.hardwareId !== incomingHash) {
            return {
              valid: false,
              reason: "HARDWARE_MISMATCH",
              message: "Lisensi ini sudah terikat dengan perangkat hardware lain.",
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
      },
      {
        body: t.Object({
          licenseKey: t.String(),
          appId: t.String(),
          hardwareId: t.Optional(t.String()),
          platform: t.Optional(
            t.Union([
              t.Literal("web"),
              t.Literal("desktop"),
              t.Literal("chrome_extension"),
              t.Literal("android"),
              t.Literal("general"),
            ])
          ),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "Validate License & Bind Hardware",
        },
      }
    )

    /**
     * Verifikasi Offline Grace Token (Client-side offline check simulator)
     */
    .post(
      "/verify-offline-token",
      async ({ body, set }) => {
        const { token } = body;
        const decoded = CryptoService.verifySignedToken<{
          sub: string;
          lic?: string;
          appId?: string;
          app?: string;
          hw?: string;
          seats?: number;
          type: string;
        }>(token);

        if (!decoded || decoded.type !== "offline_grace_license") {
          set.status = 401;
          return { valid: false, reason: "INVALID_OR_EXPIRED_TOKEN" };
        }

        return {
          valid: true,
          licenseKey: decoded.lic || decoded.sub,
          appId: decoded.app || decoded.appId,
          hardwareHash: decoded.hw,
          seats: decoded.seats || 3,
          mode: "OFFLINE_GRACE_ACTIVE",
        };
      },
      {
        body: t.Object({
          token: t.String(),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "Verify Offline Grace Token",
        },
      }
    )

    /**
     * Daftar seluruh kunci lisensi yang diterbitkan beserta informasi seats
     */
    .get(
      "/list",
      async ({ query }) => {
        const { appId, limit = 50, mode } = query;
        let licList;
        if (appId) {
          licList = await db.query.licenses.findMany({
            where: eq(licenses.appId, appId),
            orderBy: (lic, { desc }) => [desc(lic.createdAt)],
            limit: Number(limit),
          });
        } else if (mode) {
          const appRows = await db
            .select({ id: apps.id })
            .from(apps)
            .where(eq(apps.mode, mode));
          licList = appRows.length
            ? await db.query.licenses.findMany({
                where: inArray(licenses.appId, appRows.map((a) => a.id)),
                orderBy: (lic, { desc }) => [desc(lic.createdAt)],
                limit: Number(limit),
              })
            : [];
        } else {
          licList = await db.query.licenses.findMany({
            orderBy: (lic, { desc }) => [desc(lic.createdAt)],
            limit: Number(limit),
          });
        }

        // Ambil data aktivasi device seats untuk setiap lisensi
        const licensesWithActivations = await Promise.all(
          licList.map(async (lic) => {
            const activations = await db.query.licenseActivations.findMany({
              where: eq(licenseActivations.licenseId, lic.id),
              orderBy: (act, { desc }) => [desc(act.lastValidatedAt)],
            });
            return {
              ...lic,
              seatsUsed: activations.length,
              activations,
            };
          })
        );

        return {
          success: true,
          licenses: licensesWithActivations,
        };
      },
      {
        query: t.Object({
          appId: t.Optional(t.String()),
          limit: t.Optional(t.Numeric({ default: 50 })),
          mode: t.Optional(t.Union([t.Literal("sandbox"), t.Literal("live")])),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "List Issued Licenses & Seat Activations",
        },
      }
    )

    /**
     * Terbitkan Kunci Lisensi secara manual
     */
    .post(
      "/issue",
      async ({ body, set }) => {
        const { appId, customerEmail, grantDays = 30, maxSeats = 3, platform = "general" } = body;

        const licenseKey = LicenseService.generateLicenseKey();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + grantDays);

        const licenseId = `lic_${randomBytes(8).toString("hex")}`;
        const offlineToken = LicenseService.createOfflineGraceToken(
          licenseKey,
          appId,
          null,
          customerEmail,
          maxSeats
        );

        const [newLic] = await db
          .insert(licenses)
          .values({
            id: licenseId,
            appId,
            licenseKey,
            customerEmail,
            platform,
            status: "ACTIVE",
            maxSeats,
            offlineJwtGraceToken: offlineToken,
            expiresAt,
          })
          .returning();

        return {
          success: true,
          license: newLic,
        };
      },
      {
        body: t.Object({
          appId: t.String(),
          customerEmail: t.String(),
          grantDays: t.Optional(t.Number({ default: 30 })),
          maxSeats: t.Optional(t.Number({ default: 3 })),
          platform: t.Optional(
            t.Union([
              t.Literal("web"),
              t.Literal("desktop"),
              t.Literal("chrome_extension"),
              t.Literal("android"),
              t.Literal("general"),
            ])
          ),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "Manually Issue License",
        },
      }
    )

    /**
     * Cabut (Revoke) Kunci Lisensi
     */
    .post(
      "/revoke",
      async ({ body, set }) => {
        const { licenseKey } = body;

        const [updated] = await db
          .update(licenses)
          .set({ status: "REVOKED", updatedAt: new Date() })
          .where(eq(licenses.licenseKey, licenseKey.trim()))
          .returning();

        if (!updated) {
          set.status = 404;
          return { error: "License not found" };
        }

        return {
          success: true,
          message: `Kunci lisensi ${licenseKey} berhasil dicabut (REVOKED).`,
          license: updated,
        };
      },
      {
        body: t.Object({
          licenseKey: t.String(),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "Revoke License Key",
        },
      }
    )

    /**
     * Reset / Unbind Hardware ID & Clear Device Seats
     */
    .post(
      "/unbind-hardware",
      async ({ body, set }) => {
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
      },
      {
        body: t.Object({
          licenseKey: t.String(),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "Unbind Hardware ID & Release Seats",
        },
      }
    );
}

export const licensingRoutes = createLicensingRouter("/licensing");
export const licenseLegacyRoutes = createLicensingRouter("/license");
