import { Elysia, t } from "elysia";
import { db } from "../../db";
import { apps } from "../../db/schema";
import { eq, desc, and } from "drizzle-orm";
import { authenticateSecretApiKey } from "../../middleware/auth";
import type { Builder } from "../../db/schema/builders";
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
  .onBeforeHandle(async ({ request: { headers }, status }) => {
    const result = await authenticateSecretApiKey(headers);
    if ("status" in result) return status(result.status, { error: result.error });
  })
  .resolve(async ({ request: { headers } }) => {
    const result = await authenticateSecretApiKey(headers);
    return { builder: ("status" in result ? null : result.builder) as Builder };
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
        security: [{ BuilderSecretKey: [] }],
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
      params: t.Object({ appId: t.String() }),
      detail: {
        tags: ["S2S API"],
        summary: "Detail aplikasi",
        security: [{ BuilderSecretKey: [] }],
      },
    }
  )

  /**
   * Daftar lisensi (filter appId/status/limit) — scoped ke aplikasi milik builder
   */
  .get("/licenses", handleS2SListLicenses, {
    query: t.Object({
      appId: t.Optional(t.String()),
      status: t.Optional(
        t.Union([t.Literal("ACTIVE"), t.Literal("REVOKED"), t.Literal("EXPIRED")])
      ),
      limit: t.Optional(t.Numeric({ default: 50 })),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "List lisensi builder",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  /**
   * Terbitkan lisensi secara programatik (tanpa pembayaran) untuk app milik builder
   */
  .post("/licenses/issue", handleS2SIssueLicense, {
    body: t.Object({
      appId: t.String(),
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
      features: t.Optional(
        t.Record(t.String(), t.Any(), { description: "Entitlements / feature flags" })
      ),
      licenseVersion: t.Optional(t.Numeric({ default: 1 })),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "Terbitkan lisensi (issuance programatik)",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  /**
   * Cabut lisensi milik builder (termasuk denylist token offline)
   */
  .post("/licenses/revoke", handleS2SRevokeLicense, {
    body: t.Object({ licenseKey: t.String() }),
    detail: {
      tags: ["S2S API"],
      summary: "Cabut lisensi",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  /**
   * Cek saldo kredit lisensi milik builder
   */
  .get("/credits/balance", handleS2SCreditBalance, {
    query: t.Object({ licenseKey: t.String() }),
    detail: {
      tags: ["S2S API"],
      summary: "Saldo kredit lisensi",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  /**
   * Konsumsi kredit lisensi milik builder (metering server-to-server, idempoten via reference)
   */
  .post("/credits/consume", handleS2SCreditConsume, {
    body: t.Object({
      licenseKey: t.String(),
      amount: t.Numeric(),
      reference: t.Optional(t.String()),
      reason: t.Optional(t.String()),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "Konsumsi kredit lisensi",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  /**
   * Fase 2/6 — Daftar seat (aktivasi + lease floating) lisensi milik builder.
   */
  .get("/licenses/seats", handleS2SListSeats, {
    query: t.Object({ licenseKey: t.String() }),
    detail: {
      tags: ["S2S API"],
      summary: "List seat lisensi (aktivasi + lease)",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  /**
   * Fase 6 — Paksa lepas satu seat (force-release) milik builder.
   */
  .post("/licenses/seat/release", handleS2SReleaseSeat, {
    body: t.Object({ licenseKey: t.String(), hwid: t.String() }),
    detail: {
      tags: ["S2S API"],
      summary: "Force-release one device seat",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  /**
   * Fase 6 — Pulihkan lisensi dari device hilang (recover): reset seluruh seat device.
   */
  .post("/licenses/recover", handleS2SRecoverLicense, {
    body: t.Object({ licenseKey: t.String() }),
    detail: {
      tags: ["S2S API"],
      summary: "Recover lisensi saat device hilang",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  /**
   * Fase 6 — Transfer kepemilikan lisensi ke customer lain.
   */
  .post("/licenses/transfer", handleS2STransferLicense, {
    body: t.Object({ licenseKey: t.String(), newCustomerEmail: t.String() }),
    detail: {
      tags: ["S2S API"],
      summary: "Transfer lisensi ke customer lain",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  /**
   * Fase 4 — Audit trail lifecycle lisensi milik builder.
   */
  .get("/licenses/events", handleS2SLicenseEvents, {
    query: t.Object({
      licenseKey: t.Optional(t.String()),
      appId: t.Optional(t.String()),
      event: t.Optional(t.String()),
      actorType: t.Optional(t.String()),
      limit: t.Optional(t.Numeric({ default: 50 })),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "Audit trail lisensi (event-sourced)",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  /**
   * Fase 2/6 — Terbitkan batch lisensi sekaligus.
   */
  .post("/licenses/issue-batch", handleS2SIssueBatch, {
    body: t.Object({
      appId: t.String(),
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
        })
      ),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "Batch issue lisensi (hingga 200)",
      security: [{ BuilderSecretKey: [] }],
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
      security: [{ BuilderSecretKey: [] }],
    },
  })

  /**
   * Fase 3 — Kelola webhook endpoint lifecycle lisensi.
   */
  .get("/webhooks", handleS2SListWebhooks, {
    detail: {
      tags: ["S2S API"],
      summary: "List webhook endpoints + event yang tersedia",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  .post("/webhooks", handleS2SCreateWebhook, {
    body: t.Object({
      url: t.String(),
      events: t.Optional(t.Array(t.String(), { description: "Kosong = langganan semua event" })),
      secret: t.Optional(t.String({ description: "Opsional; bila kosong dibuat otomatis" })),
      isActive: t.Optional(t.Boolean({ default: true })),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "Daftarkan webhook endpoint",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  .patch("/webhooks/:id", handleS2SUpdateWebhook, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      url: t.Optional(t.String()),
      events: t.Optional(t.Array(t.String())),
      isActive: t.Optional(t.Boolean()),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "Perbarui webhook endpoint",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  .delete("/webhooks/:id", handleS2SDeleteWebhook, {
    params: t.Object({ id: t.String() }),
    detail: {
      tags: ["S2S API"],
      summary: "Hapus webhook endpoint",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  .post("/webhooks/:id/rotate-secret", handleS2SRotateWebhookSecret, {
    params: t.Object({ id: t.String() }),
    detail: {
      tags: ["S2S API"],
      summary: "Rotate secret HMAC webhook",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  .post("/webhooks/:id/test", handleS2STestWebhook, {
    params: t.Object({ id: t.String() }),
    detail: {
      tags: ["S2S API"],
      summary: "Kirim test delivery webhook",
      security: [{ BuilderSecretKey: [] }],
    },
  });
