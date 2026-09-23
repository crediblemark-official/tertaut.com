import { db } from "../../db";
import {
  licenses,
  licenseActivations,
  apps,
  builders,
  webhookEndpoints,
  webhookDeliveries,
} from "../../db/schema";
import { eq, inArray, and, sql, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { LicenseService } from "../../services/license";
import { CreditService } from "../../services/credits";
import { AuditService } from "../../services/audit";
import { WebhookService, WEBHOOK_EVENTS } from "../../services/webhooks";
import { resolveCurrentBuilder } from "../apps/builder";
import { verifyOwnedApp, verifyOwnedLicense } from "../../lib/ownership";
import { parsePagination, paginationEnvelope } from "../../lib/pagination";
import { getClientIp } from "../../lib/ip";

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

export interface ListEventsContext {
  query?: {
    licenseKey?: string;
    appId?: string;
    event?: string;
    actorType?: string;
    limit?: number | string;
    offset?: number | string;
  };
  request?: { headers?: Headers | any };
  set?: SetStatusContext | any;
}

export interface RenewLicenseContext {
  body?: {
    licenseKey?: string;
    additionalDays?: number | string;
    days?: number | string;
    [key: string]: any;
  };
  request?: { headers?: Headers | any };
  set?: SetStatusContext | any;
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
    conditions.push(
      inArray(
        licenses.appId,
        builderApps.map((a) => a.id)
      )
    );
  } else if (!isAdmin && !builder) {
    return { success: true, licenses: [], total: 0, hasMore: false };
  }

  if (appId) {
    conditions.push(eq(licenses.appId, appId));
  } else if (mode) {
    const appRows = await db.select({ id: apps.id }).from(apps).where(eq(apps.mode, mode));
    if (appRows.length === 0) {
      return { success: true, licenses: [], total: 0, hasMore: false };
    }
    conditions.push(
      inArray(
        licenses.appId,
        appRows.map((a) => a.id)
      )
    );
  }

  const pagination = parsePagination({ limit, offset, page });

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(licenses)
    .where(whereClause);

  const total = totalRes?.count || 0;

  const licList = await db.query.licenses.findMany({
    where: whereClause,
    orderBy: (lic, { desc }) => [desc(lic.createdAt)],
    limit: pagination.limit,
    offset: pagination.offset,
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
    ...paginationEnvelope(licList, total, pagination),
  };
}

export async function handleIssueLicense({
  body,
  request,
  set,
}: {
  body: IssueLicenseBody;
  request?: { headers?: Headers };
  set?: any;
}) {
  const { builder, isAdmin } = request?.headers
    ? await resolveCurrentBuilder(request.headers)
    : !request
      ? { builder: null, isAdmin: true }
      : { builder: null, isAdmin: false };

  if (!isAdmin && !builder) {
    if (set) set.status = 401;
    return { success: false, error: "Unauthorized" };
  }

  // IDOR-1: Validasi kepemilikan appId oleh builder pemanggil
  if (!isAdmin && builder) {
    const owned = await verifyOwnedApp(builder.id, body.appId, isAdmin);
    if ("error" in owned) {
      if (set) set.status = owned.status;
      return { success: false, error: owned.error };
    }
  }

  const ipAddress = getClientIp(request);

  const result = await LicenseService.issueDirect({
    appId: body.appId,
    customerEmail: body.customerEmail,
    grantDays: body.grantDays,
    maxSeats: body.maxSeats,
    platform: body.platform,
    grantCredits: body.grantCredits,
    features: body.features,
    creditDescription: "Penerbitan lisensi manual",
    actor: isAdmin
      ? { type: "ADMIN", id: builder?.id ?? "platform-admin" }
      : { type: "BUILDER", id: builder?.id },
    ipAddress,
  });

  return {
    success: true,
    license: result.license,
    creditBalance: result.creditBalance,
  };
}

export async function handleRevokeLicense({
  body,
  request,
  set,
}: {
  body: { licenseKey: string };
  request?: { headers?: Headers };
  set: SetStatusContext;
}) {
  const { licenseKey } = body;
  const { builder, isAdmin } = request?.headers
    ? await resolveCurrentBuilder(request.headers)
    : !request
      ? { builder: null, isAdmin: true }
      : { builder: null, isAdmin: false };

  if (!isAdmin && !builder) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  // IDOR-2: Validasi kepemilikan lisensi oleh builder pemanggil
  if (!isAdmin && builder) {
    const owned = await verifyOwnedLicense(builder.id, licenseKey, isAdmin);
    if ("error" in owned) {
      set.status = owned.status;
      return { error: owned.error };
    }
  }

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

export async function handleVerifyApiKey({
  body,
  set,
}: {
  body: { apiKey?: string };
  set: SetStatusContext;
}) {
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

export async function handleListEvents({ query, request, set }: ListEventsContext) {
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

export async function handleRenewLicense({ body, set, request }: RenewLicenseContext) {
  const { licenseKey, additionalDays, days } = body || {};

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
      case "daily":
        daysToAdd = 1;
        break;
      case "weekly":
        daysToAdd = 7;
        break;
      case "monthly":
        daysToAdd = 30;
        break;
      case "every_3_months":
        daysToAdd = 90;
        break;
      case "every_6_months":
        daysToAdd = 180;
        break;
      case "yearly":
        daysToAdd = 365;
        break;
      default:
        daysToAdd = app?.deliveryConfig?.licenseKey?.expiresInDays || 30;
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

  const ipAddress = getClientIp(request);

  await AuditService.record(
    "license.renewed",
    {
      licenseId: lic.id,
      licenseKey: lic.licenseKey,
      appId: lic.appId,
      actorType: isAdmin ? "ADMIN" : "BUILDER",
      actorId: builder?.id || null,
      ipAddress,
    },
    { additionalDays: daysToAdd, newExpiry: baseDate.toISOString() }
  );

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
