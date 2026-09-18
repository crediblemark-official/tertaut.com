import { db } from "../../db";
import { licenses, licenseActivations, apps, builders, webhookEndpoints, webhookDeliveries } from "../../db/schema";
import { eq, inArray, and, sql, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { LicenseService } from "../../services/license";
import { CreditService } from "../../services/credits";
import { AuditService } from "../../services/audit";
import { WebhookService, WEBHOOK_EVENTS } from "../../services/webhooks";
import { resolveCurrentBuilder } from "../apps/builder";

interface ListLicensesQuery {
  appId?: string;
  limit?: number | string;
  offset?: number | string;
  page?: number | string;
  mode?: "sandbox" | "live";
}

interface ListLicensesContext {
  query?: ListLicensesQuery;
  request?: { headers?: Headers };
}

interface IssueLicenseBody {
  appId: string;
  customerEmail: string;
  grantDays?: number;
  maxSeats?: number;
  platform?: "web" | "desktop" | "chrome_extension" | "android" | "general";
  grantCredits?: number;
  features?: Record<string, any>;
}

interface SetStatusContext {
  status?: number | string;
}

export async function handleListLicenses({ query, request }: ListLicensesContext) {
  const { appId, limit = 200, offset = 0, page, mode } = query || {};
  const headers = request?.headers;
  const { builder, isAdmin } = headers
    ? await resolveCurrentBuilder(headers)
    : { builder: null, isAdmin: true };

  const conditions: any[] = [];

  // Scoping data ke builder login (kecuali admin)
  if (!isAdmin && builder) {
    const builderApps = await db
      .select({ id: apps.id })
      .from(apps)
      .where(eq(apps.builderId, builder.id));
    if (builderApps.length === 0) {
      return { success: true, licenses: [], total: 0, hasMore: false };
    }
    conditions.push(inArray(licenses.appId, builderApps.map((a) => a.id)));
  } else if (!isAdmin && !builder) {
    return { success: true, licenses: [], total: 0, hasMore: false };
  }

  if (appId) {
    conditions.push(eq(licenses.appId, appId));
  } else if (mode) {
    const appRows = await db
      .select({ id: apps.id })
      .from(apps)
      .where(eq(apps.mode, mode));
    if (appRows.length === 0) {
      return { success: true, licenses: [], total: 0, hasMore: false };
    }
    conditions.push(inArray(licenses.appId, appRows.map((a) => a.id)));
  }

  const parsedLimit = Math.max(1, Math.min(Number(limit) || 200, 500));
  const parsedOffset = page ? (Math.max(1, Number(page)) - 1) * parsedLimit : Math.max(0, Number(offset) || 0);

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(licenses)
    .where(whereClause);

  const total = totalRes?.count || 0;

  const licList = await db.query.licenses.findMany({
    where: whereClause,
    orderBy: (lic, { desc }) => [desc(lic.createdAt)],
    limit: parsedLimit,
    offset: parsedOffset,
  });

  // Batch-fetch seluruh aktivasi device seats (hindari N+1).
  const licenseIds = licList.map((lic) => lic.id);
  const allActivations =
    licenseIds.length > 0
      ? await db.query.licenseActivations.findMany({
          where: inArray(licenseActivations.licenseId, licenseIds),
          orderBy: (act, { desc }) => [desc(act.lastValidatedAt)],
        })
      : [];
  const activationsByLicense = new Map<string, any[]>();
  for (const act of allActivations) {
    const list = activationsByLicense.get(act.licenseId) || [];
    list.push(act);
    activationsByLicense.set(act.licenseId, list);
  }
  const licensesWithActivations = licList.map((lic) => ({
    ...lic,
    seatsUsed: (activationsByLicense.get(lic.id) || []).length,
    activations: activationsByLicense.get(lic.id) || [],
  }));

  return {
    success: true,
    licenses: licensesWithActivations,
    total,
    limit: parsedLimit,
    offset: parsedOffset,
    hasMore: parsedOffset + licList.length < total,
  };
}

export async function handleIssueLicense({ body, request }: { body: IssueLicenseBody; request?: { headers?: Headers } }) {
  const { builder, isAdmin } = request?.headers
    ? await resolveCurrentBuilder(request.headers)
    : { builder: null, isAdmin: false };

  const ipAddress =
    request?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
    request?.headers?.get?.("x-real-ip") ||
    null;

  const result = await LicenseService.issueDirect({
    appId: body.appId,
    customerEmail: body.customerEmail,
    grantDays: body.grantDays,
    maxSeats: body.maxSeats,
    platform: body.platform,
    grantCredits: body.grantCredits,
    features: body.features,
    creditDescription: "Penerbitan lisensi manual",
    actor: isAdmin ? { type: "ADMIN", id: builder?.id ?? "platform-admin" } : { type: "BUILDER", id: builder?.id },
    ipAddress,
  });

  return {
    success: true,
    license: result.license,
    creditBalance: result.creditBalance,
  };
}

export async function handleRevokeLicense({ body, set }: { body: { licenseKey: string }; set: SetStatusContext }) {
  const { licenseKey } = body;
  const result = await LicenseService.revoke({ licenseKey });

  if (result.notFound) {
    set.status = 404;
    return { error: "License not found" };
  }

  return {
    success: true,
    message: result.message,
    tokenDenylisted: result.tokenDenylisted,
    license: result.license,
  };
}

export async function handleVerifyApiKey({ body, set }: { body: { apiKey?: string }; set: SetStatusContext }) {
  const { apiKey } = body;

  if (!apiKey || typeof apiKey !== "string") {
    set.status = 400;
    return { success: false, valid: false, error: "apiKey wajib disertakan" };
  }

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.apiKey, apiKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { success: false, valid: false, error: "Kunci API tidak ditemukan" };
  }

  const expired = lic.expiresAt ? new Date(lic.expiresAt).getTime() < Date.now() : false;
  const valid = lic.status === "ACTIVE" && !expired;
  const credits = valid ? await CreditService.getBalance(lic.id) : 0;

  return {
    success: true,
    valid,
    status: expired && lic.status === "ACTIVE" ? "EXPIRED" : lic.status,
    appId: lic.appId,
    customerEmail: lic.customerEmail,
    expiresAt: lic.expiresAt,
    credits,
  };
}

export async function handleListEvents({ query, request, set }: any) {
  const headers = request?.headers;
  const { builder, isAdmin } = headers
    ? await resolveCurrentBuilder(headers)
    : { builder: null, isAdmin: false };

  const limit = Number(query?.limit) || 50;
  const offset = Number(query?.offset) || 0;

  // Scope: bila bukan admin, peristiwa hanya untuk app milik builder.
  if (!isAdmin && !builder) {
    return { success: true, events: [], total: 0 };
  }

  if (query?.licenseKey) {
    const lic = await db.query.licenses.findFirst({
      where: eq(licenses.licenseKey, String(query.licenseKey).trim()),
    });
    if (!lic) {
      set.status = 404;
      return { success: false, error: "Lisensi tidak ditemukan" };
    }
    if (!isAdmin) {
      const app = await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
      if (!builder || !app || app.builderId !== builder.id) {
        set.status = 404;
        return { success: false, error: "Lisensi tidak ditemukan" };
      }
    }
    return AuditService.query({
      licenseKey: lic.licenseKey,
      event: query?.event,
      actorType: query?.actorType,
      limit,
      offset,
    });
  }

  if (query?.appId) {
    const app = await db.query.apps.findFirst({ where: eq(apps.id, String(query.appId)) });
    const owned = isAdmin || Boolean(app && builder && app.builderId === builder.id);
    if (!app || !owned) {
      set.status = 404;
      return { success: false, error: "Aplikasi tidak ditemukan" };
    }
    return AuditService.query({
      appId: app.id,
      event: query?.event,
      actorType: query?.actorType,
      limit,
      offset,
    });
  }

  // Tanpa scope: tampilkan peristiwa seluruh app builder (kecuali admin).
  if (!isAdmin && builder) {
    const builderApps = await db
      .select({ id: apps.id })
      .from(apps)
      .where(eq(apps.builderId, builder.id));
    if (builderApps.length === 0) {
      return { success: true, events: [], total: 0 };
    }
    return AuditService.query({
      appIds: builderApps.map((a) => a.id),
      event: query?.event,
      actorType: query?.actorType,
      limit,
      offset,
    });
  }

  return AuditService.query({
    event: query?.event,
    actorType: query?.actorType,
    limit,
    offset,
  });
}

export async function handleRenewLicense({
  body,
  set,
  request,
}: {
  body: { licenseKey?: string; additionalDays?: number; days?: number };
  set: SetStatusContext;
  request?: { headers?: Headers };
}) {
  const { licenseKey, additionalDays, days } = body;

  if (!licenseKey || typeof licenseKey !== "string") {
    set.status = 400;
    return { success: false, error: "licenseKey wajib disertakan" };
  }

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { success: false, error: "Lisensi tidak ditemukan" };
  }

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, lic.appId),
  });

  const { builder, isAdmin } = request?.headers
    ? await resolveCurrentBuilder(request.headers)
    : { builder: null, isAdmin: false };

  if (!isAdmin && (!builder || app?.builderId !== builder.id)) {
    set.status = 404;
    return { success: false, error: "Lisensi tidak ditemukan" };
  }

  let daysToAdd = Number(additionalDays || days);
  if (!daysToAdd || daysToAdd <= 0) {
    switch (app?.billingPeriod) {
      case "daily": daysToAdd = 1; break;
      case "weekly": daysToAdd = 7; break;
      case "monthly": daysToAdd = 30; break;
      case "every_3_months": daysToAdd = 90; break;
      case "every_6_months": daysToAdd = 180; break;
      case "yearly": daysToAdd = 365; break;
      default: daysToAdd = app?.deliveryConfig?.licenseKey?.expiresInDays || 30;
    }
  }

  const currentExpiry = lic.expiresAt ? new Date(lic.expiresAt) : new Date();
  const baseDate = currentExpiry.getTime() > Date.now() ? currentExpiry : new Date();
  baseDate.setDate(baseDate.getDate() + daysToAdd);

  const [updated] = await db
    .update(licenses)
    .set({
      status: "ACTIVE",
      expiresAt: baseDate,
      updatedAt: new Date(),
    })
    .where(eq(licenses.id, lic.id))
    .returning();

  const ipAddress =
    request?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
    request?.headers?.get?.("x-real-ip") ||
    null;

  await AuditService.record("license.renewed", {
    licenseId: lic.id,
    licenseKey: lic.licenseKey,
    appId: lic.appId,
    actorType: isAdmin ? "ADMIN" : "BUILDER",
    actorId: builder?.id || null,
    ipAddress,
  }, { additionalDays: daysToAdd, newExpiry: baseDate.toISOString() });

  await WebhookService.emit("license.renewed", {
    license: updated,
    app: app || null,
    actorType: isAdmin ? "ADMIN" : "BUILDER",
    actorId: builder?.id || null,
    ipAddress,
    payload: { additionalDays: daysToAdd, newExpiry: baseDate.toISOString() },
  });

  return {
    success: true,
    message: `Lisensi ${licenseKey} berhasil diperpanjang +${daysToAdd} hari.`,
    newExpiry: baseDate.toISOString(),
    extendedDays: daysToAdd,
    additionalDays: daysToAdd,
    license: updated,
  };
}

// ---------------------------------------------------------------------------
// Fase 3: Manajemen Webhook (dashboard). Scoped per-builder; admin bebas.
// ---------------------------------------------------------------------------

async function resolveWebhookActor(headers: any) {
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
      buildersList = await db.query.builders.findMany({ where: inArray(builders.id, ids as string[]) });
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

  let targetBuilderId = actor.isAdmin ? (body.builderId || actor.builder?.id) : actor.builder!.id;
  if (!targetBuilderId) {
    set.status = 400;
    return { success: false, error: "builderId wajib untuk admin" };
  }

  if (!/^https?:\/\//.test(body.url || "")) {
    set.status = 400;
    return { success: false, error: "url harus berupa endpoint HTTP(S) yang valid" };
  }
  if (Array.isArray(body.events)) {
    const invalid = body.events.filter((e: string) => !(WEBHOOK_EVENTS as readonly string[]).includes(e));
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

  const existing = await db.query.webhookEndpoints.findFirst({ where: eq(webhookEndpoints.id, params.id) });
  if (!existing) {
    set.status = 404;
    return { success: false, error: "Webhook tidak ditemukan" };
  }
  if (!actor.isAdmin && existing.builderId !== actor.builder!.id) {
    set.status = 403;
    return { success: false, error: "Bukan milik builder Anda" };
  }
  if (Array.isArray(body.events)) {
    const invalid = body.events.filter((e: string) => !(WEBHOOK_EVENTS as readonly string[]).includes(e));
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

  const existing = await db.query.webhookEndpoints.findFirst({ where: eq(webhookEndpoints.id, params.id) });
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

  const existing = await db.query.webhookEndpoints.findFirst({ where: eq(webhookEndpoints.id, params.id) });
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

  const endpoint = await db.query.webhookEndpoints.findFirst({ where: eq(webhookEndpoints.id, params.id) });
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
