import { Elysia, t } from "elysia";
import { db } from "../db";
import { licenses, licenseActivations, apps, revokedTokens } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { LicenseService } from "../services/license";
import { LicenseTokenService } from "../services/licenseToken";
import { EmailService } from "../services/email";
import { enforceRateLimit } from "../services/rateLimiter";
import { randomBytes } from "crypto";

// Common handler implementations for dual-route mounting (/licensing & /license)
async function handleActivateLicense(ctx: any) {
  const { body, set, request } = ctx;
  const { licenseKey, appId, hwid, deviceName } = body;

  const rl = enforceRateLimit(request, "licensing:activate", 20, 60_000);
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

async function handleVerifyLicense({ body, set, request }: any) {
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

  return {
    valid: true,
    status: "ACTIVE",
    gracePeriodRemainingDays,
  };
}

async function handleDeactivateLicense({ body, set, request }: any) {
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
      async ({ body, set, request }) => {
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
      async ({ body, set, request }) => {
        const { token } = body;

        const rl = enforceRateLimit(request, "licensing:verify-offline", 120, 60_000);
        if (!rl.allowed) {
          set.status = 429;
          return { valid: false, reason: "RATE_LIMITED" };
        }

        const decoded = LicenseTokenService.verify(token);
        if (!decoded.valid || !decoded.claims) {
          set.status = 401;
          return { valid: false, reason: decoded.reason || "INVALID_OR_EXPIRED_TOKEN" };
        }

        const claims = decoded.claims;

        // Denylist: token yang di-revoke tidak boleh dianggap valid.
        const revoked = await db.query.revokedTokens.findFirst({
          where: eq(revokedTokens.jti, claims.jti),
        });
        if (revoked) {
          set.status = 401;
          return { valid: false, reason: "TOKEN_REVOKED" };
        }

        // Cek status lisensi di server (revoked/expired menang atas token).
        const lic = await db.query.licenses.findFirst({
          where: eq(licenses.licenseKey, claims.lic),
        });
        if (!lic || lic.status !== "ACTIVE") {
          set.status = 401;
          return { valid: false, reason: lic ? `LICENSE_${lic.status}` : "LICENSE_NOT_FOUND" };
        }

        return {
          valid: true,
          licenseKey: claims.lic,
          appId: claims.app,
          hardwareHash: claims.hw,
          seats: claims.seats || 3,
          expiresAt: claims.exp ? new Date(claims.exp * 1000).toISOString() : null,
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
        requireAuth: true,
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

        const app = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
        await EmailService.sendLicenseIssued({
          to: customerEmail,
          appName: app?.name || "Lisensi",
          licenseKey,
          expiresAt,
        });

        return {
          success: true,
          license: newLic,
        };
      },
      {
        requireAuth: true,
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

        // Denylist jti token aktif agar token yang sudah beredar ikut tidak valid.
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

        return {
          success: true,
          message: `Kunci lisensi ${licenseKey} berhasil dicabut (REVOKED).`,
          tokenDenylisted: denylisted,
          license: updated,
        };
      },
      {
        requireAuth: true,
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
        requireAuth: true,
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
