import { randomBytes, createHmac } from "crypto";
import { db, type DBExecutor } from "../../db";
import { webhookEndpoints, webhookDeliveries, apps } from "../../db/schema";
import { eq, and, inArray, lte, or, lt, sql, gte, ne } from "drizzle-orm";
import { config } from "../../config";
import { parseWebhookUrl, sendWebhook } from "../security/webhookUrl";
import { logger } from "../../lib/logger";
import type { License } from "../../db/schema/licenses";
import type { App } from "../../db/schema/projects";

/**
 * Daftar peristiwa lifecycle lisensi yang dikirimkan ke webhook builder.
 */
export const WEBHOOK_EVENTS = [
  "payment.success",
  "payment.failed",
  "license.issued",
  "license.activated",
  "license.deactivated",
  "license.seat_full",
  "license.revoked",
  "license.reactivated",
  "license.expired",
  "license.renewed",
  "license.transferred",
  "license.unbound",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const MAX_WEBHOOK_ATTEMPTS = 6;
const WEBHOOK_TIMEOUT_MS = process.env.NODE_ENV === "test" ? 2_000 : 10_000;

interface EmitContext {
  eventId?: string;
  license: Pick<License, "id" | "licenseKey" | "appId" | "customerEmail" | "status"> | License;
  app?: App | null;
  actorType?: "ADMIN" | "BUILDER" | "S2S" | "SYSTEM" | "CLIENT";
  actorId?: string | null;
  ipAddress?: string | null;
  payload?: Record<string, any>;
}

export class WebhookService {
  /** Tanda tangan HMAC-SHA256 atas raw body dengan secret endpoint. */
  static sign(secret: string, rawBody: string): string {
    return `hmac-sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  }

  /**
   * Antrekan event ke seluruh endpoint aktif builder yang berlangganan event tsb.
   * events kosong = wildcard (langganan semua event).
   */
  static async emit(
    event: WebhookEvent,
    ctx: EmitContext,
    executor: DBExecutor = db
  ): Promise<number> {
    try {
      const app =
        ctx.app || (await executor.query.apps.findFirst({ where: eq(apps.id, ctx.license.appId) }));
      if (!app) return 0;

      const eventId = ctx.eventId || `evt_${crypto.randomUUID()}`;
      const rawPayload: Record<string, any> = {
        id: eventId,
        event,
        timestamp: new Date().toISOString(),
        data: {
          licenseKey: ctx.license.licenseKey,
          appId: ctx.license.appId,
          customerEmail: ctx.license.customerEmail,
          status: ctx.license.status,
          ...(ctx.payload || {}),
        },
        actor: ctx.actorType ? { type: ctx.actorType, id: ctx.actorId || null } : undefined,
      };

      const endpoints = await executor.query.webhookEndpoints.findMany({
        where: eq(webhookEndpoints.builderId, app.builderId),
      });

      const rawBody = JSON.stringify(rawPayload);
      // Parse kembali untuk membersihkan nilai undefined (JSON tidak support undefined).
      // payload column (jsonb) tidak menerima undefined.
      const cleanPayload = JSON.parse(rawBody);
      let queued = 0;

      for (const endpoint of endpoints) {
        if (!endpoint.isActive) continue;
        if (endpoint.appId && endpoint.appId !== app.id) continue;
        if (endpoint.events.length > 0 && !endpoint.events.includes(event)) continue;

        const signature = this.sign(endpoint.secret, rawBody);
        await executor
          .insert(webhookDeliveries)
          .values({
            id: `whd_${randomBytes(8).toString("hex")}`,
            endpointId: endpoint.id,
            eventId,
            event,
            payload: cleanPayload,
            signature,
            status: "PENDING",
            attempts: 0,
            nextRetryAt: new Date(),
          })
          .onConflictDoNothing();
        queued += 1;
      }

      return queued;
    } catch (err: any) {
      if (executor !== db) throw err;
      // Webhook tidak boleh mengganggu jalur kritis (best-effort).
      console.error("[Webhook] gagal mengantre event:", err?.message || err);
      return 0;
    }
  }

  /**
   * Antrekan event transaksi pembayaran ke endpoint builder
   */
  static async emitPayment(
    event: "payment.success" | "payment.failed",
    ctx: {
      eventId?: string;
      transaction: any;
      app?: App | null;
      payload?: Record<string, any>;
    },
    executor: DBExecutor = db
  ): Promise<number> {
    try {
      const app =
        ctx.app ||
        (await executor.query.apps.findFirst({ where: eq(apps.id, ctx.transaction.appId) }));
      if (!app) return 0;

      const eventId = ctx.eventId || `evt_${crypto.randomUUID()}`;
      const rawPayload: Record<string, any> = {
        id: eventId,
        event,
        timestamp: new Date().toISOString(),
        data: {
          transactionId: ctx.transaction.id,
          appId: app.id,
          appName: app.name,
          orderId: ctx.transaction.externalId || ctx.transaction.id,
          amount: ctx.transaction.grossAmount,
          netAmount: ctx.transaction.netAmount,
          platformFee: ctx.transaction.platformFee,
          paymentChannel: ctx.transaction.paymentChannel || "QRIS",
          customerEmail: ctx.transaction.customerEmail,
          customerName: ctx.transaction.customerName || undefined,
          metadata: ctx.transaction.metadata || undefined,
          status: ctx.transaction.paymentStatus,
          paidAt: ctx.transaction.paidAt,
          ...(ctx.payload || {}),
        },
      };

      const endpoints = await executor.query.webhookEndpoints.findMany({
        where: eq(webhookEndpoints.builderId, app.builderId),
      });

      const rawBody = JSON.stringify(rawPayload);
      // Parse kembali untuk membersihkan nilai undefined (JSON tidak support undefined).
      // payload column (jsonb) tidak menerima undefined.
      const cleanPayload = JSON.parse(rawBody);
      let queued = 0;

      for (const endpoint of endpoints) {
        if (!endpoint.isActive) continue;
        if (endpoint.appId && endpoint.appId !== app.id) continue;
        if (endpoint.events.length > 0 && !endpoint.events.includes(event)) continue;

        const signature = this.sign(endpoint.secret, rawBody);
        await executor
          .insert(webhookDeliveries)
          .values({
            id: `whd_${randomBytes(8).toString("hex")}`,
            endpointId: endpoint.id,
            eventId,
            event,
            payload: cleanPayload,
            signature,
            status: "PENDING",
            attempts: 0,
            nextRetryAt: new Date(),
          })
          .onConflictDoNothing();
        queued += 1;
      }

      return queued;
    } catch (err: any) {
      if (executor !== db) throw err;
      console.error("[Webhook] gagal mengantre event payment:", err?.message || err);
      return 0;
    }
  }

  /**
   * Siklus deliverer outbox: kirim delivery yang jatuh tempo.
   * Retry exponential backoff: nextRetryAt = now + 2^attempts * 30 detik.
   */
  static async dispatchDue(options?: { endpointId?: string; limit?: number }): Promise<number> {
    const now = new Date();
    const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
    const claimToken = crypto.randomUUID();
    const due = await db.transaction(async (trx) => {
      await trx
        .update(webhookDeliveries)
        .set({ status: "FAILED", claimToken: null, lockedUntil: null, updatedAt: now })
        .where(
          and(
            eq(webhookDeliveries.status, "PROCESSING"),
            lt(webhookDeliveries.lockedUntil, now),
            gte(webhookDeliveries.attempts, MAX_WEBHOOK_ATTEMPTS)
          )
        );
      const rows = await trx
        .select()
        .from(webhookDeliveries)
        .where(
          and(
            or(
              and(eq(webhookDeliveries.status, "PENDING"), lte(webhookDeliveries.nextRetryAt, now)),
              and(
                eq(webhookDeliveries.status, "PROCESSING"),
                lt(webhookDeliveries.lockedUntil, now)
              )
            ),
            lt(webhookDeliveries.attempts, MAX_WEBHOOK_ATTEMPTS),
            options?.endpointId ? eq(webhookDeliveries.endpointId, options.endpointId) : undefined
          )
        )
        .orderBy(webhookDeliveries.nextRetryAt)
        .limit(limit)
        .for("update", { skipLocked: true });
      if (!rows.length) return [];
      return trx
        .update(webhookDeliveries)
        .set({
          status: "PROCESSING",
          claimToken,
          lockedUntil: new Date(Date.now() + (limit + 1) * WEBHOOK_TIMEOUT_MS + 30_000),
          attempts: sql`${webhookDeliveries.attempts} + 1`,
          lastAttemptAt: now,
          updatedAt: now,
        })
        .where(
          inArray(
            webhookDeliveries.id,
            rows.map((row) => row.id)
          )
        )
        .returning();
    });
    if (due.length === 0) return 0;

    const endpoints = await db.query.webhookEndpoints.findMany({
      where: inArray(webhookEndpoints.id, [
        ...new Set(due.map((d) => d.endpointId).filter(Boolean)),
      ] as string[]),
    });
    const endpointById = new Map(endpoints.map((e) => [e.id, e]));

    let attempted = 0;
    for (const delivery of due) {
      const endpoint = delivery.endpointId ? endpointById.get(delivery.endpointId) : undefined;
      if (!endpoint || !endpoint.isActive) {
        await db
          .update(webhookDeliveries)
          .set({ status: "FAILED", claimToken: null, lockedUntil: null, updatedAt: new Date() })
          .where(
            and(
              eq(webhookDeliveries.id, delivery.id),
              eq(webhookDeliveries.claimToken, claimToken),
              eq(webhookDeliveries.status, "PROCESSING")
            )
          );
        continue;
      }

      const rawBody = JSON.stringify(delivery.payload);
      // Tanda tangan selalu dihitung ulang dari body yang benar-benar dikirim
      // (payload jsonb hasil round-trip DB bisa berbeda urutan kunci dari saat emit).
      const signature = this.sign(endpoint.secret, rawBody);

      let ok = false;
      let httpStatus: number | null = null;
      let errorMessage = "";
      try {
        const status = await sendWebhook(
          endpoint.url,
          rawBody,
          {
            "Content-Type": "application/json",
            "X-Tertaut-Event": delivery.event,
            "X-Tertaut-Signature": signature,
            "X-Tertaut-Signature-Algorithm": "HMAC-SHA256",
            "X-Tertaut-Delivery": delivery.id,
            "User-Agent": "tertaut-webhook-dispatcher/2.3.0",
          },
          WEBHOOK_TIMEOUT_MS
        );
        httpStatus = status;
        ok = status >= 200 && status < 300;
        if (!ok) {
          errorMessage = `HTTP ${status}`;
        }
      } catch (err: unknown) {
        errorMessage = err instanceof Error ? err.message : String(err);
        ok = false;
      }

      // Klasifikasi error permanen (terminal) vs transien:
      // Error SSRF, URL tidak valid, dan HTTP 4xx (kecuali 408/429) tidak akan berhasil jika di-retry.
      const isTerminal =
        (httpStatus !== null &&
          httpStatus >= 400 &&
          httpStatus < 500 &&
          httpStatus !== 408 &&
          httpStatus !== 429) ||
        errorMessage.includes("Alamat jaringan internal tidak diizinkan") ||
        errorMessage.includes("alamat IP publik") ||
        errorMessage.includes("tanpa kredensial") ||
        errorMessage.includes("Invalid URL");

      if (!ok) {
        logger.debug(
          `[Webhook] delivery ${delivery.id} -> ${endpoint.url} gagal: ${errorMessage}${
            isTerminal ? " [TERMINAL]" : ""
          }`
        );
      }

      const attempts = delivery.attempts;
      const failed = attempts >= MAX_WEBHOOK_ATTEMPTS || isTerminal;
      await db
        .update(webhookDeliveries)
        .set({
          status: ok ? "SENT" : failed ? "FAILED" : "PENDING",
          claimToken: null,
          lockedUntil: null,
          attempts,
          lastAttemptAt: new Date(),
          nextRetryAt: ok
            ? delivery.nextRetryAt
            : failed
              ? delivery.nextRetryAt
              : new Date(Date.now() + Math.pow(2, attempts) * 30_000),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(webhookDeliveries.id, delivery.id),
            eq(webhookDeliveries.claimToken, claimToken),
            eq(webhookDeliveries.status, "PROCESSING")
          )
        );

      attempted += 1;
      if (!ok) {
        if (failed) {
          logger.debug(
            `[Webhook] delivery ${delivery.id} ditandai FAILED permanen (${
              isTerminal
                ? "kegagalan tidak dapat diulang"
                : `mencapai ${MAX_WEBHOOK_ATTEMPTS} attempts`
            }).`
          );
        } else {
          logger.debug(
            `[Webhook] delivery ${delivery.id} gagal (attempt ${attempts}), retry dalam ${
              Math.pow(2, attempts) * 30
            } detik.`
          );
        }
      }
    }
    return attempted;
  }

  static async list(builderId: string, appId?: string) {
    if (appId) {
      return db.query.webhookEndpoints.findMany({
        where: and(eq(webhookEndpoints.builderId, builderId), eq(webhookEndpoints.appId, appId)),
        orderBy: (e, { desc }) => [desc(e.createdAt)],
      });
    }
    return db.query.webhookEndpoints.findMany({
      where: eq(webhookEndpoints.builderId, builderId),
      orderBy: (e, { desc }) => [desc(e.createdAt)],
    });
  }

  static async create(
    builderId: string,
    input: {
      appId?: string | null;
      url: string;
      events?: string[];
      secret?: string;
      isActive?: boolean;
    }
  ) {
    parseWebhookUrl(input.url);
    const newSecret = input.secret || this.generateSecret();

    // Pastikan 1 proyek maksimal 1 webhook endpoint
    if (input.appId) {
      const existing = await db.query.webhookEndpoints.findFirst({
        where: and(
          eq(webhookEndpoints.builderId, builderId),
          eq(webhookEndpoints.appId, input.appId)
        ),
      });

      if (existing) {
        const [updated] = await db
          .update(webhookEndpoints)
          .set({
            url: input.url,
            events: Array.isArray(input.events) ? input.events : existing.events,
            isActive: input.isActive ?? existing.isActive,
            secret: input.secret || existing.secret,
            updatedAt: new Date(),
          })
          .where(eq(webhookEndpoints.id, existing.id))
          .returning();

        await db
          .update(apps)
          .set({ webhookUrl: input.url, updatedAt: new Date() })
          .where(eq(apps.id, input.appId));

        return updated;
      }
    }

    const [endpoint] = await db
      .insert(webhookEndpoints)
      .values({
        id: `whk_${randomBytes(8).toString("hex")}`,
        builderId,
        appId: input.appId || null,
        url: input.url,
        secret: newSecret,
        events: Array.isArray(input.events) ? input.events : [],
        isActive: input.isActive ?? true,
      })
      .returning();

    if (input.appId) {
      await db
        .update(apps)
        .set({ webhookUrl: input.url, updatedAt: new Date() })
        .where(eq(apps.id, input.appId));
    }

    return endpoint;
  }

  static async update(
    builderId: string,
    endpointId: string,
    patch: { url?: string; events?: string[]; isActive?: boolean; appId?: string | null }
  ) {
    if (patch.url !== undefined) parseWebhookUrl(patch.url);
    const [updated] = await db
      .update(webhookEndpoints)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.builderId, builderId)))
      .returning();

    if (updated && updated.appId && patch.url !== undefined) {
      await db
        .update(apps)
        .set({ webhookUrl: patch.url, updatedAt: new Date() })
        .where(eq(apps.id, updated.appId));
    }

    return updated || null;
  }

  static async delete(builderId: string, endpointId: string) {
    // Foreign-key ON DELETE CASCADE removes deliveries only for an owned endpoint.
    const deleted = await db
      .delete(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.builderId, builderId)))
      .returning({ id: webhookEndpoints.id, appId: webhookEndpoints.appId });

    if (deleted.length > 0 && deleted[0].appId && db.update) {
      try {
        await db
          .update(apps)
          .set({ webhookUrl: null, updatedAt: new Date() })
          .where(eq(apps.id, deleted[0].appId));
      } catch {}
    }

    return deleted.length > 0;
  }

  static async rotateSecret(builderId: string, endpointId: string) {
    const newSecret = this.generateSecret();
    const [updated] = await db
      .update(webhookEndpoints)
      .set({ secret: newSecret, updatedAt: new Date() })
      .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.builderId, builderId)))
      .returning();
    return updated || null;
  }

  static async listDeliveries(builderId: string, limit = 100, endpointId?: string) {
    const endpoints = await db.query.webhookEndpoints.findMany({
      where: endpointId
        ? and(eq(webhookEndpoints.builderId, builderId), eq(webhookEndpoints.id, endpointId))
        : eq(webhookEndpoints.builderId, builderId),
    });
    if (endpoints.length === 0) return [];
    const endpointIds = endpoints.map((e) => e.id);
    return db.query.webhookDeliveries.findMany({
      where: inArray(webhookDeliveries.endpointId, endpointIds),
      orderBy: (d, { desc }) => [desc(d.createdAt)],
      limit,
    });
  }

  static async retryDelivery(builderId: string, deliveryId: string) {
    const delivery = await db.query.webhookDeliveries.findFirst({
      where: eq(webhookDeliveries.id, deliveryId),
    });
    if (!delivery || !delivery.endpointId) return { ok: false, error: "Delivery not found" };

    const endpoint = await db.query.webhookEndpoints.findFirst({
      where: and(
        eq(webhookEndpoints.id, delivery.endpointId),
        eq(webhookEndpoints.builderId, builderId)
      ),
    });
    if (!endpoint) return { ok: false, error: "Forbidden: Not your endpoint" };

    if (
      delivery.status === "PROCESSING" &&
      delivery.lockedUntil &&
      delivery.lockedUntil > new Date()
    ) {
      return { ok: false, error: "Delivery sedang diproses worker" };
    }
    const reset = await db
      .update(webhookDeliveries)
      .set({
        attempts: 0,
        claimToken: null,
        lockedUntil: null,
        status: "PENDING",
        nextRetryAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(webhookDeliveries.id, deliveryId),
          or(
            ne(webhookDeliveries.status, "PROCESSING"),
            lte(webhookDeliveries.lockedUntil, new Date())
          )
        )
      )
      .returning({ id: webhookDeliveries.id });
    if (!reset.length) return { ok: false, error: "Delivery sedang diproses worker" };

    await this.dispatchDue({ endpointId: endpoint.id, limit: 1 });

    const refreshed = await db.query.webhookDeliveries.findFirst({
      where: eq(webhookDeliveries.id, deliveryId),
    });
    return { ok: true, delivery: refreshed };
  }

  private static generateSecret(): string {
    return createHmac("sha256", randomBytes(32)).update(`whsec_${Date.now()}`).digest("hex");
  }
}
