import { Elysia, t } from "elysia";
import {
  handleActivateLicense,
  handleVerifyLicense,
  handleDeactivateLicense,
  handleValidateLicense,
  handleUnbindHardware,
} from "./device";
import {
  handleCreditBalance,
  handleConsumeCredits,
  handleCreditHistory,
} from "./credits";
import { handleVerifyOfflineToken } from "./token";
import {
  handleListLicenses,
  handleIssueLicense,
  handleRevokeLicense,
} from "./admin";

export function createLicensingRouter(prefix: string) {
  return new Elysia({ prefix })
    /**
     * PRD 7.1 A: Activate License & Bind Device Seat
     */
    .post("/activate", handleActivateLicense, {
      body: t.Object({
        licenseKey: t.String(),
        appId: t.String(),
        hwid: t.String(),
        deviceName: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Universal Licensing"],
        summary: "Activate License & Bind Device Seat",
        description:
          "Binds hardware device to license seat within N_active <= N_max quota and returns signed offline JWT token",
      },
    })

    /**
     * PRD 7.1 B: Validate / Verify License (Online Check)
     */
    .post("/verify", handleVerifyLicense, {
      body: t.Object({
        licenseKey: t.String(),
        hwid: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Universal Licensing"],
        summary: "Validate License (Online Check)",
        description: "Verifies license validity and device seat assignment (< 50ms)",
      },
    })

    /**
     * PRD 7.1 C: Deactivate / Unlink Device Seat
     */
    .post("/deactivate", handleDeactivateLicense, {
      body: t.Object({
        licenseKey: t.String(),
        hwid: t.String(),
      }),
      detail: {
        tags: ["Universal Licensing"],
        summary: "Deactivate / Unlink Device Seat",
        description: "Releases a device seat for reuse on another machine",
      },
    })

    /**
     * Saldo kredit lisensi (ledger).
     */
    .post("/credits/balance", handleCreditBalance, {
      body: t.Object({
        licenseKey: t.String(),
        hwid: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Credits"],
        summary: "Get License Credit Balance",
      },
    })

    /**
     * Pemakaian kredit oleh aplikasi (atomik, anti saldo negatif).
     */
    .post("/credits/consume", handleConsumeCredits, {
      body: t.Object({
        licenseKey: t.String(),
        hwid: t.String(),
        amount: t.Number({ minimum: 1 }),
        reason: t.Optional(t.String()),
        reference: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Credits"],
        summary: "Consume License Credits",
      },
    })

    /**
     * Riwayat ledger kredit lisensi.
     */
    .post("/credits/history", handleCreditHistory, {
      body: t.Object({
        licenseKey: t.String(),
        hwid: t.Optional(t.String()),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 200 })),
      }),
      detail: {
        tags: ["Credits"],
        summary: "License Credit Ledger History",
      },
    })

    /**
     * Legacy / SDK Generic License Validation
     */
    .post("/validate", handleValidateLicense, {
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
    })

    /**
     * Verifikasi Offline Grace Token (Client-side offline check simulator)
     */
    .post("/verify-offline-token", handleVerifyOfflineToken, {
      body: t.Object({
        token: t.String(),
      }),
      detail: {
        tags: ["Universal Licensing"],
        summary: "Verify Offline Grace Token",
      },
    })

    /**
     * Daftar seluruh kunci lisensi yang diterbitkan beserta informasi seats
     */
    .get("/list", handleListLicenses, {
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
    })

    /**
     * Terbitkan Kunci Lisensi secara manual
     */
    .post("/issue", handleIssueLicense, {
      requireAuth: true,
      body: t.Object({
        appId: t.String(),
        customerEmail: t.String(),
        grantDays: t.Optional(t.Number({ default: 30 })),
        maxSeats: t.Optional(t.Number({ default: 3 })),
        grantCredits: t.Optional(t.Number({ default: 0 })),
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
    })

    /**
     * Cabut (Revoke) Kunci Lisensi
     */
    .post("/revoke", handleRevokeLicense, {
      requireAuth: true,
      body: t.Object({
        licenseKey: t.String(),
      }),
      detail: {
        tags: ["Universal Licensing"],
        summary: "Revoke License Key",
      },
    })

    /**
     * Reset / Unbind Hardware ID & Clear Device Seats
     */
    .post("/unbind-hardware", handleUnbindHardware, {
      requireAuth: true,
      body: t.Object({
        licenseKey: t.String(),
      }),
      detail: {
        tags: ["Universal Licensing"],
        summary: "Unbind Hardware ID & Release Seats",
      },
    });
}

export const licensingRoutes = createLicensingRouter("/licensing");
export const licenseLegacyRoutes = createLicensingRouter("/license");
