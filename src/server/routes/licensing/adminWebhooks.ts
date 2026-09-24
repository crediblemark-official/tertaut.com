import { db } from "../../db";
import { webhookEndpoints, webhookDeliveries, builders } from "../../db/schema";
import { eq, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { WebhookService, WEBHOOK_EVENTS } from "../../services/webhooks";
import { resolveCurrentBuilder } from "../apps/builder";

/**
 * Fase 3: Manajemen Webhook (dashboard). Scoped per-builder; admin bebas.
 */
export async function resolveWebhookActor(headers: any) {
  const { builder, isAdmin } = await resolveCurrentBuilder(headers);
  if (!isAdmin && !builder) {
    return { error: "Autentikasi diperlukan" as const };
  }
  return { builder, isAdmin };
}

export async function handleListWebhooks({ request, set }: any) {
  const headers = request?.headers;
  const actor = headers ? await resolveWebhookActor(headers) : { error: "no-headers" };
  if ("error" in actor) {
    set.status = 403;
    return { success: false, error: actor.error };
  }
  if (!actor.isAdmin && !actor.builder) {
    set.status = 403;
    return { success: false, error: "Autentikasi diperlukan" };
  }

  let webhooks;
  let buildersList: Record<string, any>[] = [];
  if (actor.isAdmin) {
    webhooks = await db.query.webhookEndpoints.findMany({
      orderBy: (e, { desc }) => [desc(e.createdAt)],
    });
    const ids = [...new Set(webhooks.map((w) => w.builderId))];
    if (ids.length) {
      buildersList = await db.query.builders.findMany({
        where: inArray(builders.id, ids as string[]),
      });
    }
    const byId = new Map(buildersList.map((b) => [b.id, b]));
    webhooks = webhooks.map((w) => ({
      ...w,
      builderEmail: byId.get(w.builderId)?.email || null,
      builderName: byId.get(w.builderId)?.name || null,
    }));
  } else {
    webhooks = await WebhookService.list(actor.builder!.id);
  }

  return { success: true, events: WEBHOOK_EVENTS, webhooks };
}

export async function handleCreateWebhook({ body, request, set }: any) {
  const headers = request?.headers;
  const actor = headers ? await resolveWebhookActor(headers) : { error: "no-headers" };
  if ("error" in actor) {
    set.status = 403;
    return { success: false, error: actor.error };
  }

  let targetBuilderId = actor.isAdmin ? body.builderId || actor.builder?.id : actor.builder!.id;
  if (!targetBuilderId) {
    set.status = 400;
    return { success: false, error: "builderId wajib untuk admin" };
  }

  if (!/^https?:\/\//.test(body.url || "")) {
    set.status = 400;
    return { success: false, error: "url harus berupa endpoint HTTP(S) yang valid" };
  }
  if (Array.isArray(body.events)) {
    const invalid = body.events.filter(
      (e: string) => !(WEBHOOK_EVENTS as readonly string[]).includes(e)
    );
    if (invalid.length > 0) {
      set.status = 400;
      return { success: false, error: `Event tidak dikenal: ${invalid.join(", ")}` };
    }
  }

  const endpoint = await WebhookService.create(targetBuilderId, {
    url: body.url,
    events: body.events || [],
    secret: body.secret,
    isActive: body.isActive ?? true,
  });

  return { success: true, webhook: endpoint };
}

export async function handleUpdateWebhook({ params, body, request, set }: any) {
  const headers = request?.headers;
  const actor = headers ? await resolveWebhookActor(headers) : { error: "no-headers" };
  if ("error" in actor) {
    set.status = 403;
    return { success: false, error: actor.error };
  }

  const existing = await db.query.webhookEndpoints.findFirst({
    where: eq(webhookEndpoints.id, params.id),
  });
  if (!existing) {
    set.status = 404;
    return { success: false, error: "Webhook tidak ditemukan" };
  }
  if (!actor.isAdmin && existing.builderId !== actor.builder!.id) {
    set.status = 403;
    return { success: false, error: "Bukan milik builder Anda" };
  }
  if (body.url !== undefined && !/^https?:\/\//.test(body.url || "")) {
    set.status = 400;
    return { success: false, error: "url harus berupa endpoint HTTP(S) yang valid" };
  }
  if (Array.isArray(body.events)) {
    const invalid = body.events.filter(
      (e: string) => !(WEBHOOK_EVENTS as readonly string[]).includes(e)
    );
    if (invalid.length > 0) {
      set.status = 400;
      return { success: false, error: `Event tidak dikenal: ${invalid.join(", ")}` };
    }
  }

  const updated = await WebhookService.update(existing.builderId, existing.id, {
    url: body.url,
    events: body.events,
    isActive: body.isActive,
  });
  return { success: true, webhook: updated };
}

export async function handleDeleteWebhook({ params, request, set }: any) {
  const headers = request?.headers;
  const actor = headers ? await resolveWebhookActor(headers) : { error: "no-headers" };
  if ("error" in actor) {
    set.status = 403;
    return { success: false, error: actor.error };
  }

  const existing = await db.query.webhookEndpoints.findFirst({
    where: eq(webhookEndpoints.id, params.id),
  });
  if (!existing) {
    set.status = 404;
    return { success: false, error: "Webhook tidak ditemukan" };
  }
  if (!actor.isAdmin && existing.builderId !== actor.builder!.id) {
    set.status = 403;
    return { success: false, error: "Bukan milik builder Anda" };
  }

  await WebhookService.delete(existing.builderId, existing.id);
  return { success: true, message: "Webhook endpoint dihapus." };
}

export async function handleRotateWebhookSecret({ params, request, set }: any) {
  const headers = request?.headers;
  const actor = headers ? await resolveWebhookActor(headers) : { error: "no-headers" };
  if ("error" in actor) {
    set.status = 403;
    return { success: false, error: actor.error };
  }

  const existing = await db.query.webhookEndpoints.findFirst({
    where: eq(webhookEndpoints.id, params.id),
  });
  if (!existing) {
    set.status = 404;
    return { success: false, error: "Webhook tidak ditemukan" };
  }
  if (!actor.isAdmin && existing.builderId !== actor.builder!.id) {
    set.status = 403;
    return { success: false, error: "Bukan milik builder Anda" };
  }

  const updated = await WebhookService.rotateSecret(existing.builderId, existing.id);
  return { success: true, webhook: updated };
}

export async function handleTestWebhook({ params, request, set }: any) {
  const headers = request?.headers;
  const actor = headers ? await resolveWebhookActor(headers) : { error: "no-headers" };
  if ("error" in actor) {
    set.status = 403;
    return { success: false, error: actor.error };
  }

  const endpoint = await db.query.webhookEndpoints.findFirst({
    where: eq(webhookEndpoints.id, params.id),
  });
  if (!endpoint) {
    set.status = 404;
    return { success: false, error: "Webhook tidak ditemukan" };
  }
  if (!actor.isAdmin && endpoint.builderId !== actor.builder!.id) {
    set.status = 403;
    return { success: false, error: "Bukan milik builder Anda" };
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
