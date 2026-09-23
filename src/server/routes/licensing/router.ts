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
          licenseKey: t.String({ description: "Kunci lisensi (TT-...)" }),
          hwid: t.Optional(
            t.String({ description: "Hardware ID perangkat untuk verifikasi seat" })
          ),
        }),
        detail: {
          tags: ["Credits"],
          summary: "Get License Credit Balance",
          description:
            "Mengambil sisa saldo kredit aktif yang dimiliki lisensi. Digunakan untuk aplikasi dengan model bisnis berbasis pemakaian (metered/usage-based credits).",
          responses: {
            200: {
              description: "Informasi saldo kredit dan kuota terpakai",
            },
            404: {
              description: "Lisensi tidak ditemukan atau tidak aktif",
            },
          },
        },
      })

      /**
       * Pemakaian kredit oleh aplikasi (atomik, anti saldo negatif).
       */
      .post("/credits/consume", handleConsumeCredits, {
        body: t.Object({
          licenseKey: t.String({ description: "Kunci lisensi (TT-...)" }),
          hwid: t.String({ description: "Hardware ID perangkat pengonsumsi" }),
          amount: t.Number({ minimum: 1, description: "Jumlah unit kredit yang ingin dikonsumsi" }),
          reason: t.Optional(t.String({ description: "Deskripsi pemakaian (mis. export_pdf_hd)" })),
          reference: t.Optional(
            t.String({ description: "Idempotency key unik untuk mencegah double-debit" })
          ),
        }),
        detail: {
          tags: ["Credits"],
          summary: "Consume License Credits",
          description:
            "Mengurangi saldo kredit lisensi secara atomik (database lock) dengan pencegahan saldo negatif dan dukungan idempotensi via reference key.",
          responses: {
            200: {
              description: "Kredit berhasil didebit atau permintaan idempoten sebelumnya ditemukan",
            },
            402: {
              description: "Saldo kredit tidak mencukupi (INSUFFICIENT_CREDITS)",
            },
            404: {
              description: "Lisensi tidak ditemukan",
            },
          },
        },
      })

      /**
       * Riwayat ledger kredit lisensi.
       */
      .post("/credits/history", handleCreditHistory, {
        body: t.Object({
          licenseKey: t.String({ description: "Kunci lisensi (TT-...)" }),
          hwid: t.Optional(t.String({ description: "Hardware ID perangkat" })),
          limit: t.Optional(t.Number({ minimum: 1, maximum: 200, default: 50 })),
        }),
        detail: {
          tags: ["Credits"],
          summary: "License Credit Ledger History",
          description:
            "Audit trail mutasi kredit lisensi: riwayat penambahan (top-up/pembelian) dan pengurangan kredit (konsumsi).",
          responses: {
            200: {
              description: "Daftar entri ledger mutasi kredit",
            },
          },
        },
      })

      /**
       * Legacy / SDK Generic License Validation
       */
      .post("/validate", handleValidateLicense, {
        body: t.Object({
          licenseKey: t.String({ description: "Kunci lisensi (TT-...)" }),
          appId: t.String({ description: "ID aplikasi tertaut" }),
          hardwareId: t.Optional(t.String({ description: "Hardware fingerprint ID perangkat" })),
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
          description:
            "Endpoint validasi serbaguna yang memeriksa status lisensi, mengikat device ke slot seat yang tersedia, memeriksa floor version aplikasi, dan menerbitkan Ed25519 token offline.",
          responses: {
            200: {
              description: "Lisensi valid dan perangkat terikat",
            },
            403: {
              description:
                "Lisensi dicabut, kedaluwarsa, kuota seat habis, atau versi aplikasi terlalu lama",
            },
          },
        },
      })

      /**
       * Verifikasi Offline Grace Token (Client-side offline check simulator)
       */
      .post("/verify-offline-token", handleVerifyOfflineToken, {
        body: t.Object({
          token: t.String({ description: "Signed Ed25519 offline license JWT token" }),
        }),
        detail: {
          tags: ["Universal Licensing"],
          summary: "Verify Offline Grace Token",
          description:
            "Memverifikasi keabsahan token offline Ed25519 dan memeriksa apakah token telah dimasukkan ke denylist revocations server.",
          responses: {
            200: {
              description: "Token offline valid dan grace period aktif",
            },
            401: {
              description: "Token tidak valid, kedaluwarsa, atau telah dicabut (TOKEN_REVOKED)",
            },
          },
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
