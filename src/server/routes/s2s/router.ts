import { Elysia, t } from "elysia";
import { db } from "../../db";
import { apps } from "../../db/schema";
import { eq, desc, and } from "drizzle-orm";
import { authenticateSecretApiKey } from "../../middleware/auth";
import { ownedApp } from "./helpers";
import {
  handleS2SListLicenses,
  handleS2SIssueLicense,
  handleS2SRevokeLicense,
  handleS2SListSeats,
  handleS2SReleaseSeat,
  handleS2SRecoverLicense,
  handleS2STransferLicense,
  handleS2SLicenseEvents,
  handleS2SIssueBatch,
  handleS2SRevokeBatch,
} from "./licenses";
import { handleS2SCreditBalance, handleS2SCreditConsume } from "./credits";
import {
  handleS2SListWebhooks,
  handleS2SCreateWebhook,
  handleS2SUpdateWebhook,
  handleS2SDeleteWebhook,
  handleS2SRotateWebhookSecret,
  handleS2STestWebhook,
} from "./webhooks";

export const s2sRoutes = new Elysia({ prefix: "/s2s" })
  // Auth sekali per request (sebelumnya dipanggil 2× di onBeforeHandle + resolve,
  // memicu 2 query DB ganda). Resolve berfungsi sebagai guard: status(401) menghentikan request.
  .resolve(async ({ request: { headers }, status }) => {
    const result = await authenticateSecretApiKey(headers);
    if ("status" in result) return status(result.status, { error: result.error });
    return { builder: result.builder };
  })

  /**
   * Info akun + pengenal environment S2S
   */
  .get(
    "/",
    ({ builder }) => ({
      service: "tertaut.com Server-to-Server API",
      builder: { id: builder.id, email: builder.email, name: builder.name },
    }),
    {
      detail: {
        tags: ["S2S API"],
        summary: "S2S info akun",
        description: "Mengembalikan identitas builder dari secret API key (Bearer tt_secret_...)",
        security: [{ BuilderSecretKey: [] }],
      },
    }
  )

  /**
   * Daftar aplikasi milik builder (termasuk publishable apiKey untuk SDK)
   */
  .get(
    "/apps",
    ({ builder, query }) => {
      return db.query.apps.findMany({
        where: query.mode
          ? and(eq(apps.builderId, builder.id), eq(apps.mode, query.mode))
          : eq(apps.builderId, builder.id),
        orderBy: [desc(apps.createdAt)],
      });
    },
    {
      query: t.Object({
        mode: t.Optional(t.Union([t.Literal("sandbox"), t.Literal("live")])),
      }),
      detail: {
        tags: ["S2S API"],
        summary: "List aplikasi builder",
        description:
          "Mengambil daftar seluruh aplikasi milik builder, termasuk publishable apiKey untuk konfigurasi frontend SDK.",
        security: [{ BuilderSecretKey: [] }],
        responses: {
          200: { description: "Daftar aplikasi builder berhasil diambil" },
          401: { description: "Secret API key tidak valid atau hilang" },
        },
      },
    }
  )

  /**
   * Detail satu aplikasi milik builder
   */
  .get(
    "/apps/:appId",
    async ({ builder, params: { appId }, set }) => {
      const app = await ownedApp(builder, appId);
      if (!app) {
        set.status = 404;
        return { error: "App tidak ditemukan atau bukan milik builder" };
      }
      return app;
    },
    {
      params: t.Object({ appId: t.String({ description: "ID aplikasi (app_...)" }) }),
      detail: {
        tags: ["S2S API"],
        summary: "Detail aplikasi",
        description: "Mengambil konfigurasi lengkap satu aplikasi milik builder.",
        security: [{ BuilderSecretKey: [] }],
        responses: {
          200: { description: "Data detail aplikasi" },
          404: { description: "Aplikasi tidak ditemukan atau bukan milik builder" },
        },
      },
    }
  )

  /**
   * Daftar lisensi (filter appId/status/limit) — scoped ke aplikasi milik builder
   */
  .get("/licenses", handleS2SListLicenses, {
    query: t.Object({
      appId: t.Optional(t.String({ description: "Filter berdasarkan ID aplikasi" })),
      status: t.Optional(
        t.Union([t.Literal("ACTIVE"), t.Literal("REVOKED"), t.Literal("EXPIRED")], {
          description: "Filter status lisensi",
        })
      ),
      limit: t.Optional(t.Numeric({ default: 50, description: "Jumlah data per halaman" })),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "List lisensi builder",
      description:
        "Mengambil daftar lisensi terbitan builder dengan opsi filter appId, status keaktifan, dan paginasi.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Daftar lisensi dan kuota seat" },
      },
    },
  })

  /**
   * Terbitkan lisensi secara programatik (tanpa pembayaran) untuk app milik builder
   */
  .post("/licenses/issue", handleS2SIssueLicense, {
    body: t.Object({
      appId: t.String({ description: "ID aplikasi target" }),
      customerEmail: t.String({ description: "Email customer pemilik lisensi" }),
      grantDays: t.Optional(t.Numeric({ default: 30, description: "Masa aktif dalam hari" })),
      maxSeats: t.Optional(
        t.Numeric({ default: 3, description: "Batas maksimal perangkat (seats)" })
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
      grantCredits: t.Optional(
        t.Numeric({ default: 0, description: "Saldo kredit awal yang diberikan" })
      ),
      features: t.Optional(
        t.Record(t.String(), t.Any(), { description: "Entitlements / feature flags kustom" })
      ),
      licenseVersion: t.Optional(t.Numeric({ default: 1 })),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "Terbitkan lisensi (issuance programatik)",
      description:
        "Menerbitkan kunci lisensi baru (format TT-XXXX-XXXX-XXXX) secara programatik tanpa melewati alur checkout pembayaran.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Lisensi berhasil diterbitkan" },
        400: { description: "Parameter input tidak valid" },
      },
    },
  })

  /**
   * Cabut lisensi milik builder (termasuk denylist token offline)
   */
  .post("/licenses/revoke", handleS2SRevokeLicense, {
    body: t.Object({
      licenseKey: t.String({ description: "Kunci lisensi (TT-...) yang akan dicabut" }),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "Cabut lisensi",
      description:
        "Mencabut lisensi secara permanen. Status lisensi diubah menjadi REVOKED, offline token dimasukkan ke denylist, dan seat dinonaktifkan.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Lisensi berhasil dicabut" },
        404: { description: "Lisensi tidak ditemukan" },
      },
    },
  })

  /**
   * Cek saldo kredit lisensi milik builder
   */
  .get("/credits/balance", handleS2SCreditBalance, {
    query: t.Object({ licenseKey: t.String({ description: "Kunci lisensi (TT-...)" }) }),
    detail: {
      tags: ["S2S API"],
      summary: "Saldo kredit lisensi",
      description:
        "Memeriksa sisa unit kredit aktif yang dimiliki lisensi tertentu dari sisi server.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Informasi saldo kredit lisensi" },
      },
    },
  })

  /**
   * Konsumsi kredit lisensi milik builder (metering server-to-server, idempoten via reference)
   */
  .post("/credits/consume", handleS2SCreditConsume, {
    body: t.Object({
      licenseKey: t.String({ description: "Kunci lisensi (TT-...)" }),
      amount: t.Numeric({ description: "Jumlah unit kredit yang ingin didebit" }),
      reference: t.Optional(
        t.String({ description: "Idempotency key unik untuk mencegah duplikasi potongan" })
      ),
      reason: t.Optional(t.String({ description: "Alasan atau nama fitur yang dikonsumsi" })),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "Konsumsi kredit lisensi",
      description:
        "Mendebit saldo kredit lisensi secara aman dan idempoten (anti saldo negatif) dari backend builder.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Kredit berhasil didebit" },
        402: { description: "Saldo kredit tidak cukup" },
      },
    },
  })

  /**
   * Fase 2/6 — Daftar seat (aktivasi + lease floating) lisensi milik builder.
   */
  .get("/licenses/seats", handleS2SListSeats, {
    query: t.Object({ licenseKey: t.String({ description: "Kunci lisensi (TT-...)" }) }),
    detail: {
      tags: ["S2S API"],
      summary: "List seat lisensi (aktivasi + lease)",
      description:
        "Mengembalikan daftar seluruh perangkat yang sedang aktif terikat pada lisensi beserta data lease floating.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Daftar seat perangkat aktif" },
      },
    },
  })

  /**
   * Fase 6 — Paksa lepas satu seat (force-release) milik builder.
   */
  .post("/licenses/seat/release", handleS2SReleaseSeat, {
    body: t.Object({
      licenseKey: t.String({ description: "Kunci lisensi (TT-...)" }),
      hwid: t.String({ description: "Hardware ID perangkat yang ingin dilepas" }),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "Force-release one device seat",
      description:
        "Melepaskan ikatan satu perangkat tertentu dari kuota seat lisensi sehingga slot dapat digunakan perangkat lain.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Seat perangkat berhasil dilepas" },
      },
    },
  })

  /**
   * Fase 6 — Pulihkan lisensi dari device hilang (recover): reset seluruh seat device.
   */
  .post("/licenses/recover", handleS2SRecoverLicense, {
    body: t.Object({ licenseKey: t.String({ description: "Kunci lisensi (TT-...)" }) }),
    detail: {
      tags: ["S2S API"],
      summary: "Recover lisensi saat device hilang",
      description:
        "Mereset seluruh seat perangkat yang terikat dan membatalkan token offline lama jika perangkat pengguna hilang atau rusak.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Lisensi berhasil dipulihkan dan seluruh seat direset" },
      },
    },
  })

  /**
   * Fase 6 — Transfer kepemilikan lisensi ke customer lain.
   */
  .post("/licenses/transfer", handleS2STransferLicense, {
    body: t.Object({
      licenseKey: t.String({ description: "Kunci lisensi (TT-...)" }),
      newCustomerEmail: t.String({ description: "Alamat email pemilik baru" }),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "Transfer lisensi ke customer lain",
      description:
        "Memindahkan kepemilikan lisensi ke customer lain dan mereset device binding yang terdaftar sebelumnya.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Lisensi berhasil ditransfer" },
      },
    },
  })

  /**
   * Fase 4 — Audit trail lifecycle lisensi milik builder.
   */
  .get("/licenses/events", handleS2SLicenseEvents, {
    query: t.Object({
      licenseKey: t.Optional(t.String({ description: "Filter kunci lisensi tertentu" })),
      appId: t.Optional(t.String({ description: "Filter ID aplikasi" })),
      event: t.Optional(
        t.String({ description: "Filter jenis event (ISSUED, ACTIVATED, REVOKED, dll)" })
      ),
      actorType: t.Optional(t.String()),
      limit: t.Optional(t.Numeric({ default: 50 })),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "Audit trail lisensi (event-sourced)",
      description:
        "Riwayat log audit trail perubahan siklus hidup lisensi untuk kebutuhan verifikasi dan debugging.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Log audit trail event lisensi" },
      },
    },
  })

  /**
   * Fase 2/6 — Terbitkan batch lisensi sekaligus.
   */
  .post("/licenses/issue-batch", handleS2SIssueBatch, {
    body: t.Object({
      appId: t.String({ description: "ID aplikasi target" }),
      items: t.Array(
        t.Object({
          customerEmail: t.String(),
          grantDays: t.Optional(t.Numeric({ default: 30 })),
          maxSeats: t.Optional(t.Numeric({ default: 3 })),
          platform: t.Optional(
            t.Union([
              t.Literal("web"),
              t.Literal("desktop"),
              t.Literal("chrome_extension"),
              t.Literal("android"),
              t.Literal("general"),
            ])
          ),
          grantCredits: t.Optional(t.Numeric({ default: 0 })),
          features: t.Optional(t.Record(t.String(), t.Any())),
        }),
        { description: "Maksimal 200 lisensi dalam satu batch" }
      ),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "Batch issue lisensi (hingga 200)",
      description:
        "Menerbitkan hingga 200 lisensi sekaligus secara massal dalam satu transaksi atomik untuk efisiensi distribusi.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Seluruh lisensi batch berhasil diterbitkan" },
      },
    },
  })

  /**
   * Fase 6 — Cabut batch lisensi sekaligus.
   */
  .post("/licenses/revoke-batch", handleS2SRevokeBatch, {
    body: t.Object({
      licenseKeys: t.Array(t.String(), { description: "Maksimal 200 licenseKey per request" }),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "Batch revoke lisensi",
      description: "Mencabut hingga 200 lisensi sekaligus dalam satu kali panggilan API.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Lisensi batch berhasil dicabut" },
      },
    },
  })

  /**
   * Fase 3 — Kelola webhook endpoint lifecycle lisensi.
   */
  .get("/webhooks", handleS2SListWebhooks, {
    detail: {
      tags: ["S2S API"],
      summary: "List webhook endpoints + event yang tersedia",
      description:
        "Melihat seluruh endpoint webhook yang terdaftar beserta daftar event yang didukung (mis. payment.fulfilled, license.issued, license.revoked).",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Daftar webhook endpoint aktif" },
      },
    },
  })

  .post("/webhooks", handleS2SCreateWebhook, {
    body: t.Object({
      url: t.String({ description: "Target URL server yang menerima webhook POST HTTP" }),
      events: t.Optional(
        t.Array(t.String(), { description: "Daftar event yang dilanggani (kosong = semua event)" })
      ),
      secret: t.Optional(
        t.String({ description: "Secret HMAC kustom untuk verifikasi signature header" })
      ),
      isActive: t.Optional(t.Boolean({ default: true })),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "Daftarkan webhook endpoint",
      description:
        "Mendaftarkan endpoint URL baru untuk menerima event notifikasi real-time via webhook ber-signature HMAC.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        201: { description: "Webhook endpoint berhasil dibuat" },
      },
    },
  })

  .patch("/webhooks/:id", handleS2SUpdateWebhook, {
    params: t.Object({ id: t.String({ description: "ID webhook endpoint" }) }),
    body: t.Object({
      url: t.Optional(t.String()),
      events: t.Optional(t.Array(t.String())),
      isActive: t.Optional(t.Boolean()),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "Perbarui webhook endpoint",
      description:
        "Memperbarui URL, event subscriptions, atau status aktif/non-aktif webhook endpoint.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Webhook endpoint berhasil diperbarui" },
      },
    },
  })

  .delete("/webhooks/:id", handleS2SDeleteWebhook, {
    params: t.Object({ id: t.String({ description: "ID webhook endpoint" }) }),
    detail: {
      tags: ["S2S API"],
      summary: "Hapus webhook endpoint",
      description: "Menghapus webhook endpoint terdaftar secara permanen.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Webhook endpoint berhasil dihapus" },
      },
    },
  })

  .post("/webhooks/:id/rotate-secret", handleS2SRotateWebhookSecret, {
    params: t.Object({ id: t.String({ description: "ID webhook endpoint" }) }),
    detail: {
      tags: ["S2S API"],
      summary: "Rotate secret HMAC webhook",
      description: "Menghasilkan kunci secret HMAC baru untuk webhook endpoint.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Secret webhook berhasil dirotasi" },
      },
    },
  })

  .post("/webhooks/:id/test", handleS2STestWebhook, {
    params: t.Object({ id: t.String({ description: "ID webhook endpoint" }) }),
    detail: {
      tags: ["S2S API"],
      summary: "Kirim test delivery webhook",
      description:
        "Mengirimkan sampel payload ping ke URL webhook target untuk menguji kesiapan server Anda.",
      security: [{ BuilderSecretKey: [] }],
      responses: {
        200: { description: "Test ping webhook terkirim" },
      },
    },
  });
