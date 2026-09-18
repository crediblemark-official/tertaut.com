import { Elysia, t } from "elysia";
import { randomBytes } from "crypto";
import { db } from "../../db";
import { apps, licenses, licenseActivations, licenseLeases, webhookDeliveries } from "../../db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { authenticateSecretApiKey } from "../../middleware/auth";
import { LicenseService } from "../../services/license";
import { LicenseTokenService } from "../../services/licenseToken";
import { CreditService } from "../../services/credits";
import { LicenseLeaseService, resolveFloatingConfig } from "../../services/licenseLease";
import { AuditService } from "../../services/audit";
import { WebhookService, WEBHOOK_EVENTS } from "../../services/webhooks";
import type { Builder } from "../../db/schema/builders";

async function ownedLicense(builder: Builder, licenseKey: string) {
  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });
  if (!lic) return null;
  const app = await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
  if (!app || app.builderId !== builder.id) return null;
  return { lic, app };
}

async function ownedApp(builder: Builder, appId: string) {
  const app = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
  if (!app || app.builderId !== builder.id) return null;
  return app;
}

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
  .get("/", ({ builder }) => ({
    service: "tertaut.com Server-to-Server API",
    builder: { id: builder.id, email: builder.email, name: builder.name },
  }), {
    detail: {
      tags: ["S2S API"],
      summary: "S2S info akun",
      description: "Mengembalikan identitas builder dari secret API key (Bearer tt_secret_...)",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  /**
   * Daftar aplikasi milik builder (termasuk publishable apiKey untuk SDK)
   */
  .get("/apps", ({ builder, query }) => {
    return db.query.apps.findMany({
      where: query.mode
        ? and(eq(apps.builderId, builder.id), eq(apps.mode, query.mode))
        : eq(apps.builderId, builder.id),
      orderBy: [desc(apps.createdAt)],
    });
  }, {
    query: t.Object({
      mode: t.Optional(t.Union([t.Literal("sandbox"), t.Literal("live")])),
    }),
    detail: {
      tags: ["S2S API"],
      summary: "List aplikasi builder",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  /**
   * Detail satu aplikasi milik builder
   */
  .get("/apps/:appId", async ({ builder, params: { appId }, set }) => {
    const app = await ownedApp(builder, appId);
    if (!app) {
      set.status = 404;
      return { error: "App tidak ditemukan atau bukan milik builder" };
    }
    return app;
  }, {
    params: t.Object({ appId: t.String() }),
    detail: {
      tags: ["S2S API"],
      summary: "Detail aplikasi",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  /**
   * Daftar lisensi (filter appId/status/limit) — scoped ke aplikasi milik builder
   */
  .get("/licenses", async ({ builder, query, set }) => {
    let scope: any[] = [eq(licenses.appId, apps.id), eq(apps.builderId, builder.id)];
    if (query.appId) {
      const app = await ownedApp(builder, query.appId);
      if (!app) {
        set.status = 404;
        return { error: "App tidak ditemukan atau bukan milik builder" };
      }
      scope.push(eq(licenses.appId, query.appId));
    }
    if (query.status) scope.push(eq(licenses.status, query.status));

    const rows = await db
      .select({
        id: licenses.id,
        appId: licenses.appId,
        licenseKey: licenses.licenseKey,
        customerEmail: licenses.customerEmail,
        platform: licenses.platform,
        status: licenses.status,
        maxSeats: licenses.maxSeats,
        expiresAt: licenses.expiresAt,
        lastValidatedAt: licenses.lastValidatedAt,
        createdAt: licenses.createdAt,
        updatedAt: licenses.updatedAt,
      })
      .from(licenses)
      .innerJoin(apps, eq(licenses.appId, apps.id))
      .where(and(...scope))
      .limit(Math.min(query.limit ?? 50, 200));

    return { licenses: rows };
  }, {
    query: t.Object({
      appId: t.Optional(t.String()),
      status: t.Optional(t.Union([t.Literal("ACTIVE"), t.Literal("REVOKED"), t.Literal("EXPIRED")])),
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
  .post("/licenses/issue", async ({ builder, body, set }) => {
    const app = await ownedApp(builder, body.appId);
    if (!app) {
      set.status = 404;
      return { error: "App tidak ditemukan atau bukan milik builder" };
    }

    const result = await LicenseService.issueDirect({
      appId: app.id,
      customerEmail: body.customerEmail,
      grantDays: body.grantDays,
      maxSeats: body.maxSeats,
      platform: body.platform,
      grantCredits: body.grantCredits,
      features: body.features,
      licenseVersion: body.licenseVersion,
      creditDescription: "Penerbitan lisensi via S2S",
      actor: { type: "S2S", id: builder.id },
    });

    return { success: true, license: result.license, creditBalance: result.creditBalance };
  }, {
    body: t.Object({
      appId: t.String(),
      customerEmail: t.String(),
      grantDays: t.Optional(t.Numeric({ default: 30 })),
      maxSeats: t.Optional(t.Numeric({ default: 3 })),
      platform: t.Optional(t.Union([
        t.Literal("web"),
        t.Literal("desktop"),
        t.Literal("chrome_extension"),
        t.Literal("android"),
        t.Literal("general"),
      ])),
      grantCredits: t.Optional(t.Numeric({ default: 0 })),
      features: t.Optional(t.Record(t.String(), t.Any(), { description: "Entitlements / feature flags" })),
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
  .post("/licenses/revoke", async ({ builder, body, set }) => {
    const owned = await ownedLicense(builder, body.licenseKey);
    if (!owned) {
      set.status = 404;
      return { error: "Licensi tidak ditemukan atau bukan milik builder" };
    }

    const result = await LicenseService.revoke({
      licenseId: owned.lic.id,
      actor: { type: "S2S", id: builder.id },
    });
    if (result.notFound) {
      set.status = 404;
      return { error: "Licensi tidak ditemukan atau bukan milik builder" };
    }

    return {
      success: true,
      message: result.message,
      tokenDenylisted: result.tokenDenylisted,
      license: result.license,
    };
  }, {
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
  .get("/credits/balance", async ({ builder, query, set }) => {
    const owned = await ownedLicense(builder, query.licenseKey);
    if (!owned) {
      set.status = 404;
      return { error: "Licensi tidak ditemukan atau bukan milik builder" };
    }
    const balance = await CreditService.getBalance(owned.lic.id);
    return { success: true, licenseKey: owned.lic.licenseKey, balance };
  }, {
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
  .post("/credits/consume", async ({ builder, body, set }) => {
    const owned = await ownedLicense(builder, body.licenseKey);
    if (!owned) {
      set.status = 404;
      return { error: "Licensi tidak ditemukan atau bukan milik builder" };
    }

    const result = await CreditService.debit(
      {
        licenseId: owned.lic.id,
        appId: owned.app.id,
        customerEmail: owned.lic.customerEmail,
      },
      body.amount,
      {
        description: body.reason || "Credit consumed via S2S",
        reference: body.reference,
      }
    );

    if (!result.ok) {
      set.status = result.reason === "LICENSE_NOT_FOUND" ? 404 : 409;
      return { success: false, reason: result.reason, balance: result.balance };
    }

    return { success: true, balance: result.balance, consumed: result.consumed };
  }, {
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
  .get("/licenses/seats", async ({ builder, query, set }) => {
    const owned = await ownedLicense(builder, query.licenseKey);
    if (!owned) {
      set.status = 404;
      return { error: "Lisensi tidak ditemukan atau bukan milik builder" };
    }
    const { lic, app } = owned;
    const floating = resolveFloatingConfig(app);

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
    const seats = activations.map((act) => {
      const lease = leases.find((l) => l.hwidHash === act.hwidHash);
      return {
        hwidHash: act.hwidHash,
        deviceName: act.deviceName,
        ipAddress: act.ipAddress,
        lastValidatedAt: act.lastValidatedAt,
        createdAt: act.createdAt,
        leaseActive: floating.enabled ? Boolean(lease && lease.expiresAt > now) : null,
        lastHeartbeatAt: lease?.lastHeartbeatAt || null,
        leaseExpiresAt: lease?.expiresAt || null,
      };
    });

    return {
      success: true,
      licenseKey: lic.licenseKey,
      status: lic.status,
      floating: floating.enabled,
      maxSeats: lic.maxSeats || 3,
      seatsUsed: floating.enabled ? seats.filter((s) => s.leaseActive === true).length : seats.length,
      leaseTtlSeconds: floating.enabled ? floating.leaseTtlSeconds : null,
      seats,
    };
  }, {
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
  .post("/licenses/seat/release", async ({ builder, body, set }) => {
    const owned = await ownedLicense(builder, body.licenseKey);
    if (!owned) {
      set.status = 404;
      return { error: "Lisensi tidak ditemukan atau bukan milik builder" };
    }
    const { lic } = owned;

    const lookupHashes = LicenseService.hwidLookupHashes(body.hwid);

    await db
      .delete(licenseActivations)
      .where(
        and(
          eq(licenseActivations.licenseId, lic.id),
          inArray(licenseActivations.hwidHash, lookupHashes)
        )
      );
    const leasesReleased = await LicenseLeaseService.releaseSeat(lic.id, body.hwid);

    await AuditService.record("license.seat_released", {
      licenseId: lic.id,
      licenseKey: lic.licenseKey,
      appId: lic.appId,
      actorType: "S2S",
      actorId: builder.id,
    }, { hwid: body.hwid, leasesReleased });

    return { success: true, leasesReleased, message: "Seat perangkat berhasil dilepas." };
  }, {
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
  .post("/licenses/recover", async ({ builder, body, set }) => {
    const owned = await ownedLicense(builder, body.licenseKey);
    if (!owned) {
      set.status = 404;
      return { error: "Lisensi tidak ditemukan atau bukan milik builder" };
    }
    const { lic, app } = owned;

    await db.delete(licenseActivations).where(eq(licenseActivations.licenseId, lic.id));
    await db.delete(licenseLeases).where(eq(licenseLeases.licenseId, lic.id));
    await db.update(licenses).set({ hardwareId: null, updatedAt: new Date() }).where(eq(licenses.id, lic.id));

    const token = await LicenseService.rotateOfflineToken(
      { ...lic, features: lic.features || null },
      app?.deliveryConfig?.licenseKey?.offlineGraceDays
    );

    await AuditService.record("license.recovered", {
      licenseId: lic.id,
      licenseKey: lic.licenseKey,
      appId: lic.appId,
      actorType: "S2S",
      actorId: builder.id,
    }, { seatsReleased: true });

    return { success: true, message: "Lisensi dipulihkan. Seluruh seat device dilepas.", licenseKey: lic.licenseKey };
  }, {
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
  .post("/licenses/transfer", async ({ builder, body, set }) => {
    const owned = await ownedLicense(builder, body.licenseKey);
    if (!owned) {
      set.status = 404;
      return { error: "Lisensi tidak ditemukan atau bukan milik builder" };
    }
    const { lic } = owned;
    if (!body.newCustomerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.newCustomerEmail)) {
      set.status = 400;
      return { success: false, error: "newCustomerEmail tidak valid" };
    }

    const [updated] = await db
      .update(licenses)
      .set({ customerEmail: body.newCustomerEmail.trim().toLowerCase(), updatedAt: new Date() })
      .where(eq(licenses.id, lic.id))
      .returning();

    await AuditService.record("license.transferred", {
      licenseId: lic.id,
      licenseKey: lic.licenseKey,
      appId: lic.appId,
      actorType: "S2S",
      actorId: builder.id,
    }, { from: lic.customerEmail, to: updated.customerEmail });

    return { success: true, license: updated };
  }, {
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
  .get("/licenses/events", async ({ builder, query, set }) => {
    const owned = query.appId ? null : (query.licenseKey ? await ownedLicense(builder, query.licenseKey) : null);
    if (!owned && !query.appId) {
      set.status = 404;
      return { error: "Lisensi tidak ditemukan atau bukan milik builder" };
    }
    if (owned) {
      const events = await AuditService.query({
        licenseKey: query.licenseKey,
        event: query.event,
        actorType: query.actorType,
        limit: query.limit,
      });
      return events;
    }
    const app = await ownedApp(builder, query.appId!);
    if (!app) {
      set.status = 404;
      return { error: "App tidak ditemukan atau bukan milik builder" };
    }
    return AuditService.query({ appId: query.appId, event: query.event, limit: query.limit });
  }, {
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
  .post("/licenses/issue-batch", async ({ builder, body, set }) => {
    const app = await ownedApp(builder, body.appId);
    if (!app) {
      set.status = 404;
      return { error: "App tidak ditemukan atau bukan milik builder" };
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      set.status = 400;
      return { error: "items wajib berupa array non-kosong" };
    }
    if (body.items.length > 200) {
      set.status = 400;
      return { error: "Batch maksimal 200 lisensi per request" };
    }

    const results: any[] = [];
    const errors: any[] = [];
    for (const item of body.items) {
      try {
        const r = await LicenseService.issueDirect({
          appId: app.id,
          customerEmail: item.customerEmail,
          grantDays: item.grantDays,
          maxSeats: item.maxSeats,
          platform: item.platform,
          grantCredits: item.grantCredits,
          features: item.features,
          creditDescription: "Penerbitan batch via S2S",
          actor: { type: "S2S", id: builder.id },
        });
        results.push({ customerEmail: item.customerEmail, licenseKey: r.license.licenseKey, id: r.license.id });
      } catch (err: any) {
        errors.push({ customerEmail: item.customerEmail, error: err?.message || "ISSUE_FAILED" });
      }
    }

    return { success: true, issued: results.length, failed: errors.length, licenses: results, errors };
  }, {
    body: t.Object({
      appId: t.String(),
      items: t.Array(
        t.Object({
          customerEmail: t.String(),
          grantDays: t.Optional(t.Numeric({ default: 30 })),
          maxSeats: t.Optional(t.Numeric({ default: 3 })),
          platform: t.Optional(t.Union([
            t.Literal("web"),
            t.Literal("desktop"),
            t.Literal("chrome_extension"),
            t.Literal("android"),
            t.Literal("general"),
          ])),
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
  .post("/licenses/revoke-batch", async ({ builder, body }) => {
    if (!Array.isArray(body.licenseKeys) || body.licenseKeys.length === 0) {
      return { success: false, error: "licenseKeys wajib berupa array non-kosong" };
    }
    const results: any[] = [];
    for (const licenseKey of body.licenseKeys.slice(0, 200)) {
      const owned = await ownedLicense(builder, licenseKey);
      if (!owned) {
        results.push({ licenseKey, revoked: false, error: "NOT_FOUND_OR_UNOWNED" });
        continue;
      }
      const r = await LicenseService.revoke({
        licenseId: owned.lic.id,
        actor: { type: "S2S", id: builder.id },
      });
      results.push({ licenseKey, revoked: !r.notFound, message: r.message });
    }
    return { success: true, revoked: results.filter((r) => r.revoked).length, results };
  }, {
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
  .get("/webhooks", async ({ builder }) => ({
    success: true,
    events: [...WEBHOOK_EVENTS],
    webhooks: await WebhookService.list(builder.id),
  }), {
    detail: {
      tags: ["S2S API"],
      summary: "List webhook endpoints + event yang tersedia",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  .post("/webhooks", async ({ builder, body, set }) => {
    const validUrl = /^https?:\/\//.test(body.url);
    if (!validUrl) {
      set.status = 400;
      return { success: false, error: "url harus berupa HTTP(S) endpoint yang valid" };
    }
    if (body.events) {
      const invalid = body.events.filter((e) => !(WEBHOOK_EVENTS as readonly string[]).includes(e));
      if (invalid.length > 0) {
        set.status = 400;
        return { success: false, error: `Event tidak dikenal: ${invalid.join(", ")}` };
      }
    }
    const endpoint = await WebhookService.create(builder.id, {
      url: body.url,
      events: body.events,
      secret: body.secret,
      isActive: body.isActive,
    });
    return { success: true, webhook: endpoint };
  }, {
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

  .patch("/webhooks/:id", async ({ builder, params, body, set }) => {
    const updated = await WebhookService.update(builder.id, params.id, {
      url: body.url,
      events: body.events,
      isActive: body.isActive,
    });
    if (!updated) {
      set.status = 404;
      return { success: false, error: "Webhook tidak ditemukan" };
    }
    return { success: true, webhook: updated };
  }, {
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

  .delete("/webhooks/:id", async ({ builder, params, set }) => {
    const ok = await WebhookService.delete(builder.id, params.id);
    if (!ok) {
      set.status = 404;
      return { success: false, error: "Webhook tidak ditemukan" };
    }
    return { success: true, message: "Webhook endpoint dihapus." };
  }, {
    params: t.Object({ id: t.String() }),
    detail: {
      tags: ["S2S API"],
      summary: "Hapus webhook endpoint",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  .post("/webhooks/:id/rotate-secret", async ({ builder, params, set }) => {
    const updated = await WebhookService.rotateSecret(builder.id, params.id);
    if (!updated) {
      set.status = 404;
      return { success: false, error: "Webhook tidak ditemukan" };
    }
    return { success: true, webhook: updated };
  }, {
    params: t.Object({ id: t.String() }),
    detail: {
      tags: ["S2S API"],
      summary: "Rotate secret HMAC webhook",
      security: [{ BuilderSecretKey: [] }],
    },
  })

  .post("/webhooks/:id/test", async ({ builder, params, set }) => {
    const endpoints = await WebhookService.list(builder.id);
    const endpoint = endpoints.find((e) => e.id === params.id);
    if (!endpoint) {
      set.status = 404;
      return { success: false, error: "Webhook tidak ditemukan" };
    }
    const payload = {
      event: "license.test",
      timestamp: new Date().toISOString(),
      data: { message: "Test delivery dari tertaut.com", version: "2.3.0" },
    };
    const rawBody = JSON.stringify(payload);
    const [delivery] = await db
      .insert(webhookDeliveries)
      .values({
        id: `whd_${randomBytes(8).toString("hex")}`,
        endpointId: endpoint.id,
        event: "license.test",
        payload,
        signature: WebhookService.sign(endpoint.secret, rawBody),
        status: "PENDING",
        attempts: 0,
        nextRetryAt: new Date(),
      })
      .returning();

    const attempted = await WebhookService.dispatchDue();
    return { success: true, deliveryId: delivery.id, attempted };
  }, {
    params: t.Object({ id: t.String() }),
    detail: {
      tags: ["S2S API"],
      summary: "Kirim test delivery webhook",
      security: [{ BuilderSecretKey: [] }],
    },
  });