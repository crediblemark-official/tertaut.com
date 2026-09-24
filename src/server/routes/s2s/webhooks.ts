import { randomBytes } from "crypto";
import { db } from "../../db";
import { webhookDeliveries } from "../../db/schema";
import { WebhookService, WEBHOOK_EVENTS } from "../../services/webhooks";

/**
 * Fase 3 — Kelola webhook endpoint lifecycle lisensi via S2S.
 */
export async function handleS2SListWebhooks({ builder }: any) {
  return {
    success: true,
    events: [...WEBHOOK_EVENTS],
    webhooks: await WebhookService.list(builder.id),
  };
}

export async function handleS2SCreateWebhook({ builder, body, set }: any) {
  const validUrl = /^https?:\/\//.test(body.url);
  if (!validUrl) {
    set.status = 400;
    return { success: false, error: "url harus berupa HTTP(S) endpoint yang valid" };
  }
  if (body.events) {
    const invalid = body.events.filter(
      (e: string) => !(WEBHOOK_EVENTS as readonly string[]).includes(e)
    );
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
}

export async function handleS2SUpdateWebhook({ builder, params, body, set }: any) {
  if (body.url !== undefined && !/^https?:\/\//.test(body.url || "")) {
    set.status = 400;
    return { success: false, error: "url harus berupa HTTP(S) endpoint yang valid" };
  }
  if (body.events) {
    const invalid = body.events.filter(
      (e: string) => !(WEBHOOK_EVENTS as readonly string[]).includes(e)
    );
    if (invalid.length > 0) {
      set.status = 400;
      return { success: false, error: `Event tidak dikenal: ${invalid.join(", ")}` };
    }
  }

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
}

export async function handleS2SDeleteWebhook({ builder, params, set }: any) {
  const ok = await WebhookService.delete(builder.id, params.id);
  if (!ok) {
    set.status = 404;
    return { success: false, error: "Webhook tidak ditemukan" };
  }
  return { success: true, message: "Webhook endpoint dihapus." };
}

export async function handleS2SRotateWebhookSecret({ builder, params, set }: any) {
  const updated = await WebhookService.rotateSecret(builder.id, params.id);
  if (!updated) {
    set.status = 404;
    return { success: false, error: "Webhook tidak ditemukan" };
  }
  return { success: true, webhook: updated };
}

export async function handleS2STestWebhook({ builder, params, set }: any) {
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
}
