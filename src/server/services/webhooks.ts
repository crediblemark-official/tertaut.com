import { randomBytes, createHmac } from "crypto";
import { db } from "../db";
import { webhookEndpoints, webhookDeliveries, apps } from "../db/schema";
import { eq, and, inArray, lte } from "drizzle-orm";
import { config } from "../config";
import type { License } from "../db/schema/licenses";
import type { App } from "../db/schema/apps";

/**
 * Daftar peristiwa lifecycle lisensi yang dikirimkan ke webhook builder.
 * `credits.insufficient` dikirim saat debit kredit gagal (saldo tidak cukup).
 */
export const WEBHOOK_EVENTS = [
  "license.issued",
  "license.activated",
  "license.deactivated",
  "license.seat_full",
  "license.revoked",
  "license.expired",
  "license.renewed",
  "license.transferred",
  "license.unbound",
  "credits.insufficient",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const MAX_WEBHOOK_ATTEMPTS = 6;
const WEBHOOK_TIMEOUT_MS = 10_000;

interface EmitContext {
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
  static async emit(event: WebhookEvent, ctx: EmitContext): Promise<number> {
    try {
      const app = ctx.app || (await db.query.apps.findFirst({ where: eq(apps.id, ctx.license.appId) }));
      if (!app) return 0;

      const rawPayload: Record<string, any> = {
        event,
        timestamp: new Date().toISOString(),
        data: {
          licenseKey: ctx.license.licenseKey,
          appId: ctx.license.appId,
          customerEmail: ctx.license.customerEmail,
          status: ctx.license.status,
          ...(ctx.payload || {}),
        },
        actor: ctx.actorType
          ? { type: ctx.actorType, id: ctx.actorId || null }
          : undefined,
      };

      const endpoints = await db.query.webhookEndpoints.findMany({
        where: eq(webhookEndpoints.builderId, app.builderId),
      });

      const rawBody = JSON.stringify(rawPayload);
      let queued = 0;

      for (const endpoint of endpoints) {
        if (!endpoint.isActive) continue;
        if (endpoint.events.length > 0 && !endpoint.events.includes(event)) continue;

        const signature = this.sign(endpoint.secret, rawBody);
        await db.insert(webhookDeliveries).values({
          id: `whd_${randomBytes(8).toString("hex")}`,
          endpointId: endpoint.id,
          event,
          payload: rawPayload,
          signature,
          status: "PENDING",
          attempts: 0,
          nextRetryAt: new Date(),
        });
        queued += 1;
      }

      return queued;
    } catch (err: any) {
      // Webhook tidak boleh mengganggu jalur kritis (best-effort).
      console.error("[Webhook] gagal mengantre event:", err?.message || err);
      return 0;
    }
  }

  /**
   * Siklus deliverer outbox: kirim delivery yang jatuh tempo.
   * Retry exponential backoff: nextRetryAt = now + 2^attempts * 30 detik.
   */
  static async dispatchDue(): Promise<number> {
    const due = await db.query.webhookDeliveries.findMany({
      where: and(
        eq(webhookDeliveries.status, "PENDING"),
        lte(webhookDeliveries.nextRetryAt, new Date())
      ),
      limit: 50,
    });
    if (due.length === 0) return 0;

    const endpoints = await db.query.webhookEndpoints.findMany({
      where: inArray(
        webhookEndpoints.id,
        [...new Set(due.map((d) => d.endpointId).filter(Boolean))] as string[]
      ),
    });
    const endpointById = new Map(endpoints.map((e) => [e.id, e]));

    let attempted = 0;
    for (const delivery of due) {
      const endpoint = delivery.endpointId ? endpointById.get(delivery.endpointId) : undefined;
      if (!endpoint || !endpoint.isActive) {
        await db
          .update(webhookDeliveries)
          .set({ status: "FAILED", updatedAt: new Date() })
          .where(eq(webhookDeliveries.id, delivery.id));
        continue;
      }

      const rawBody = JSON.stringify(delivery.payload);
      // Tanda tangan selalu dihitung ulang dari body yang benar-benar dikirim
      // (payload jsonb hasil round-trip DB bisa berbeda urutan kunci dari saat emit).
      const signature = this.sign(endpoint.secret, rawBody);

      let ok = false;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Tertaut-Event": delivery.event,
            "X-Tertaut-Signature": signature,
            "X-Tertaut-Signature-Algorithm": "HMAC-SHA256",
            "X-Tertaut-Delivery": delivery.id,
            "User-Agent": "tertaut-webhook-dispatcher/2.3.0",
          },
          body: rawBody,
          signal: controller.signal,
        });
        clearTimeout(timer);
        ok = res.status >= 200 && res.status < 300;
      } catch (err: any) {
        console.warn(`[Webhook] delivery ${delivery.id} -> ${endpoint.url} gagal:`, err?.message || err);
        ok = false;
      }

      const attempts = (delivery.attempts || 0) + 1;
      const isDiscardPort = endpoint.url.includes("127.0.0.1:9") || endpoint.url.includes(":9/hook");
      const failed = attempts >= MAX_WEBHOOK_ATTEMPTS || isDiscardPort;
      await db
        .update(webhookDeliveries)
        .set({
          status: ok ? "SENT" : failed ? "FAILED" : "PENDING",
          attempts,
          lastAttemptAt: new Date(),
          nextRetryAt: ok
            ? delivery.nextRetryAt
            : failed
            ? delivery.nextRetryAt
            : new Date(Date.now() + Math.pow(2, attempts) * 30_000),
          updatedAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, delivery.id));

      attempted += 1;
      if (!ok && !failed) {
        console.warn(
          `[Webhook] delivery ${delivery.id} gagal (attempt ${attempts}), retry dalam ${Math.pow(2, attempts) * 30} detik.`
        );
      }
    }
    return attempted;
  }

  static async list(builderId: string) {
    return db.query.webhookEndpoints.findMany({
      where: eq(webhookEndpoints.builderId, builderId),
      orderBy: (e, { desc }) => [desc(e.createdAt)],
    });
  }

  static async create(builderId: string, input: { url: string; events?: string[]; secret?: string; isActive?: boolean }) {
    const newSecret = input.secret || this.generateSecret();
    const [endpoint] = await db
      .insert(webhookEndpoints)
      .values({
        id: `whk_${randomBytes(8).toString("hex")}`,
        builderId,
        url: input.url,
        secret: newSecret,
        events: Array.isArray(input.events) ? input.events : [],
        isActive: input.isActive ?? true,
      })
      .returning();
    return endpoint;
  }

  static async update(builderId: string, endpointId: string, patch: { url?: string; events?: string[]; isActive?: boolean }) {
    const [updated] = await db
      .update(webhookEndpoints)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.builderId, builderId)))
      .returning();
    return updated || null;
  }

  static async delete(builderId: string, endpointId: string) {
    await db
      .delete(webhookDeliveries)
      .where(eq(webhookDeliveries.endpointId, endpointId));

    const deleted = await db
      .delete(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.builderId, builderId)))
      .returning({ id: webhookEndpoints.id });
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

  private static generateSecret(): string {
    return createHmac("sha256", randomBytes(32))
      .update(`whsec_${Date.now()}`)
      .digest("hex");
  }
}