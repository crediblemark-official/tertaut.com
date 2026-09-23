import { Elysia, t } from "elysia";
import {
  handleActivateLicense,
  handleVerifyLicense,
  handleDeactivateLicense,
  handleValidateLicense,
  handleUnbindHardware,
  handleHeartbeat,
  handleListSeats,
} from "./device";
import { handleCreditBalance, handleConsumeCredits, handleCreditHistory } from "./credits";
import { handleVerifyOfflineToken } from "./token";
import {
  handleListLicenses,
  handleIssueLicense,
  handleRevokeLicense,
  handleRenewLicense,
  handleVerifyApiKey,
  handleListEvents,
} from "./admin";
import {
  handleListWebhooks,
  handleCreateWebhook,
  handleUpdateWebhook,
  handleDeleteWebhook,
  handleRotateWebhookSecret,
  handleTestWebhook,
} from "./adminWebhooks";

export function createLicensingRouter(prefix: string) {
  return (
    new Elysia({ prefix })
      /**
       * Fase 2: Floating License Heartbeat (rolling seat keep-alive)
       */
      .post("/heartbeat", handleHeartbeat, {
        body: t.Object({
          appId: t.Optional(t.String({ description: "ID aplikasi pemilik lisensi" })),
          licenseKey: t.String({ description: "Kunci lisensi format TT-..." }),
          hwid: t.String({ description: "Hardware ID unik perangkat klien" }),
          leaseKey: t.String({ description: "Lease key yang diterima saat /activate" }),
          deviceName: t.Optional(t.String()),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "Floating License Heartbeat",
          description:
            "Perpanjang TTL lease untuk lisensi floating. Client wajib mengirim heartbeat berkala (mis. tiap 60 detik); lease yang berhenti akan lepas dan slotnya dipakai device lain.",
        },
      })

      /**
       * Fase 2/6: Daftar seat lisensi beserta lease floating.
       */
      .get("/seats", handleListSeats, {
        requireAuth: true,
        query: t.Object({
          licenseKey: t.String(),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "List License Seats & Leases",
          description: "Mengembalikan daftar seat perangkat (aktivasi) + status lease floating.",
        },
      })

      /**
       * Fase 4: Audit trail lifecycle lisensi (append-only).
       */
      .get("/events", handleListEvents, {
        requireAuth: true,
        query: t.Object({
          licenseKey: t.Optional(t.String()),
          appId: t.Optional(t.String()),
          event: t.Optional(t.String()),
          actorType: t.Optional(t.String()),
          limit: t.Optional(t.Numeric({ default: 50 })),
          offset: t.Optional(t.Numeric()),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "License Audit Trail",
          description:
            "Mengembalikan log event lifecycle lisensi (issued/activated/revoked/dst) untuk compliance & debugging.",
        },
      })

      /**
       * PRD 7.1 A: Activate License & Bind Device Seat
       */
      .post("/activate", handleActivateLicense, {
        body: t.Object({
          licenseKey: t.String({ description: "Kunci lisensi format TT-..." }),
          appId: t.String({ description: "ID aplikasi pemilik lisensi" }),
          hwid: t.String({ description: "Hardware ID unik perangkat klien" }),
          deviceName: t.Optional(
            t.String({ description: "Nama perangkat pengguna (mis. MacBook Pro)" })
          ),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "Activate License & Bind Device Seat",
          description:
            "Binds hardware device to license seat within N_active <= N_max quota and returns signed offline JWT token",
          responses: {
            200: {
              description: "Aktivasi lisensi dan binding seat perangkat berhasil",
            },
          },
        },
      })

      /**
       * PRD 7.1 B: Validate / Verify License (Online Check)
       */
      .post("/verify", handleVerifyLicense, {
        body: t.Object({
          licenseKey: t.String({ description: "Kunci lisensi format TT-..." }),
          hwid: t.Optional(
            t.String({ description: "Hardware ID perangkat untuk verifikasi binding" })
          ),
          appVersion: t.Optional(
            t.String({
              description:
                "Versi aplikasi klien saat ini (mis. 2.4.0) untuk pengecekan version floor",
            })
          ),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "Validate License (Online Check)",
          description: "Verifies license validity and device seat assignment (< 50ms)",
          responses: {
            200: {
              description: "Hasil verifikasi lisensi online",
            },
          },
        },
      })

      /**
       * PRD 7.1 C: Deactivate / Unlink Device Seat
       */
      .post("/deactivate", handleDeactivateLicense, {
        body: t.Object({
          licenseKey: t.String({ description: "Kunci lisensi format TT-..." }),
          hwid: t.String({ description: "Hardware ID perangkat yang ingin dilepas seat-nya" }),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "Deactivate / Unlink Device Seat",
          description: "Releases a device seat for reuse on another machine",
          responses: {
            200: {
              description: "Seat perangkat berhasil dilepas",
            },
          },
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
          appVersion: t.Optional(
            t.String({
              description: "Versi aplikasi klien saat ini untuk pengecekan version floor",
            })
          ),
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
          offset: t.Optional(t.Numeric()),
          page: t.Optional(t.Numeric()),
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
      })

      /**
       * Verifikasi Kunci API pelanggan (auto-provisioning delivery apiAccess).
       */
      .post("/api-key/verify", handleVerifyApiKey, {
        body: t.Object({
          apiKey: t.String({ description: "Kunci API pelanggan (format tt_cust_...)" }),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "Verify Customer API Key",
          description:
            "Validates a customer API key issued via apiAccess delivery and returns license status & credits",
          responses: {
            200: {
              description: "Hasil verifikasi kunci API pelanggan",
            },
          },
        },
      })

      /**
       * Fase 3: Webhook endpoints — list + events yang tersedia.
       */
      .get("/webhooks", handleListWebhooks, {
        requireAuth: true,
        query: t.Object({}),
        detail: {
          tags: ["Webhooks"],
          summary: "List Webhook Endpoints",
          description: "Daftar webhook endpoint beserta event lifecycle lisensi yang tersedia.",
        },
      })

      /**
       * Fase 3: Daftarkan webhook endpoint baru.
       */
      .post("/webhooks", handleCreateWebhook, {
        requireAuth: true,
        body: t.Object({
          url: t.String(),
          events: t.Optional(
            t.Array(t.String(), { description: "Kosong = langganan semua event" })
          ),
          secret: t.Optional(t.String()),
          isActive: t.Optional(t.Boolean({ default: true })),
          builderId: t.Optional(
            t.String({ description: "Hanya untuk admin (default: builder sesi)" })
          ),
        }),
        detail: {
          tags: ["Webhooks"],
          summary: "Daftarkan Webhook Endpoint",
        },
      })

      /**
       * Fase 3: Perbarui webhook endpoint.
       */
      .patch("/webhooks/:id", handleUpdateWebhook, {
        requireAuth: true,
        params: t.Object({ id: t.String() }),
        body: t.Object({
          url: t.Optional(t.String()),
          events: t.Optional(t.Array(t.String())),
          isActive: t.Optional(t.Boolean()),
        }),
        detail: {
          tags: ["Webhooks"],
          summary: "Perbarui Webhook Endpoint",
        },
      })

      /**
       * Fase 3: Hapus webhook endpoint.
       */
      .delete("/webhooks/:id", handleDeleteWebhook, {
        requireAuth: true,
        params: t.Object({ id: t.String() }),
        detail: {
          tags: ["Webhooks"],
          summary: "Hapus Webhook Endpoint",
        },
      })

      /**
       * Fase 3: Rotasi secret HMAC webhook.
       */
      .post("/webhooks/:id/rotate-secret", handleRotateWebhookSecret, {
        requireAuth: true,
        params: t.Object({ id: t.String() }),
        detail: {
          tags: ["Webhooks"],
          summary: "Rotate Secret Webhook",
        },
      })

      /**
       * Fase 3: Kirim test delivery.
       */
      .post("/webhooks/:id/test", handleTestWebhook, {
        requireAuth: true,
        params: t.Object({ id: t.String() }),
        detail: {
          tags: ["Webhooks"],
          summary: "Kirim Test Delivery",
        },
      })

      /**
       * Perpanjang Masa Aktif Lisensi (Renewal Subscription / License Extension)
       */
      .post("/renew", handleRenewLicense, {
        requireAuth: true,
        body: t.Object({
          licenseKey: t.String(),
          additionalDays: t.Optional(t.Number()),
          days: t.Optional(t.Number()),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "Renew Subscription & Extend Expiry",
        },
      })
  );
}

export const licensingRoutes = createLicensingRouter("/licensing");
export const licenseLegacyRoutes = createLicensingRouter("/license");
