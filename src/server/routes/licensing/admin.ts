import { matchesLicenseEnvironment } from "../../lib/licenseEnvironment";
import { db } from "../../db";
import {
  licenses,
  licenseActivations,
  apps,
  builders,
  webhookEndpoints,
  webhookDeliveries,
  transactions,
  revokedTokens,
} from "../../db/schema";
import { eq, inArray, and, sql, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { LicenseService } from "../../services/licensing/license";
import { AuditService } from "../../services/security/audit";
import { WebhookService, WEBHOOK_EVENTS } from "../../services/notifications/webhooks";
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
    newExpiresAt?: string | null;
    isLifetime?: boolean;
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
  const emails = [...new Set(licList.map((lic) => lic.customerEmail.toLowerCase()))];
  const totals = licList.length
    ? await db
        .select({
          appId: transactions.appId,
          email: sql<string>`lower(${transactions.customerEmail})`,
          mode: transactions.mode,
          ltv: sql<number>`coalesce(sum(${transactions.grossAmount}),0)::bigint`,
        })
        .from(transactions)
        .where(
          and(
            inArray(transactions.appId, [...new Set(licList.map((lic) => lic.appId))]),
            inArray(sql`lower(${transactions.customerEmail})`, emails),
            eq(transactions.paymentStatus, "PAID"),
            sql`${transactions.paymentChannel} IS DISTINCT FROM 'FREE_TRIAL'`
          )
        )
        .groupBy(transactions.appId, sql`lower(${transactions.customerEmail})`, transactions.mode)
    : [];
  const ltvByCustomer = new Map(
    totals.map((row) => [`${row.mode}:${row.appId}:${row.email}`, Number(row.ltv)])
  );
  const linkedIds = licList
    .map((lic) => lic.transactionId)
    .filter((id): id is string => Boolean(id));
  const linked = linkedIds.length
    ? await db.query.transactions.findMany({ where: inArray(transactions.id, linkedIds) })
    : [];
  const trials = new Set(
    linked.filter((tx) => tx.paymentChannel === "FREE_TRIAL").map((tx) => tx.id)
  );
  const licensesWithActivations = licList.map((lic) => ({
    ...lic,
    ltv: ltvByCustomer.get(`${lic.mode}:${lic.appId}:${lic.customerEmail.toLowerCase()}`) || 0,
    isTrial: Boolean(lic.transactionId && trials.has(lic.transactionId)),
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
    features: body.features,
    actor: isAdmin
      ? { type: "ADMIN", id: builder?.id ?? "platform-admin" }
      : { type: "BUILDER", id: builder?.id },
    ipAddress,
  });

  return {
    success: true,
    license: result.license,
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

export async function handleReactivateLicense({
  body,
  request,
  set,
}: {
  body: { licenseKey: string };
  request?: { headers?: Headers };
  set: SetStatusContext;
}) {
  const { licenseKey } = body || {};
  const { builder, isAdmin } = request?.headers
    ? await resolveCurrentBuilder(request.headers)
    : !request
      ? { builder: null, isAdmin: true }
      : { builder: null, isAdmin: false };

  if (!isAdmin && !builder) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  if (!licenseKey || typeof licenseKey !== "string") {
    set.status = 400;
    return { error: "licenseKey wajib disertakan" };
  }

  // IDOR-2: Validasi kepemilikan lisensi oleh builder pemanggil
  if (!isAdmin && builder) {
    const owned = await verifyOwnedLicense(builder.id, licenseKey, isAdmin);
    if ("error" in owned) {
      set.status = owned.status;
      return { error: owned.error };
    }
  }

  const ipAddress = getClientIp(request);
  const result = await LicenseService.reactivate({
    licenseKey,
    actor: {
      type: isAdmin ? "ADMIN" : "BUILDER",
      id: builder?.id,
    },
    ipAddress,
  });

  if (result.notFound) {
    set.status = 404;
    return { error: result.error || "License not found" };
  }

  return {
    success: result.success,
    message: result.message,
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
  const valid = lic.status === "ACTIVE" && !expired && (await matchesLicenseEnvironment(lic));

  return {
    success: true,
    valid,
    status: expired && lic.status === "ACTIVE" ? "EXPIRED" : lic.status,
    appId: lic.appId,
    customerEmail: lic.customerEmail,
    expiresAt: lic.expiresAt,
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
  const { licenseKey, additionalDays, days, newExpiresAt, isLifetime } = body || {};

  if (!licenseKey || typeof licenseKey !== "string") {
    set.status = 400;
    return { success: false, error: "licenseKey wajib disertakan" };
  }

  const { builder, isAdmin } = request?.headers
    ? await resolveCurrentBuilder(request.headers)
    : !request
      ? { builder: null, isAdmin: true }
      : { builder: null, isAdmin: false };

  if (!isAdmin && !builder) {
    set.status = 401;
    return { success: false, error: "Unauthorized" };
  }

  // IDOR check: verifikasi kepemilikan lisensi oleh builder pemanggil
  if (!isAdmin && builder) {
    const owned = await verifyOwnedLicense(builder.id, licenseKey, isAdmin);
    if ("error" in owned) {
      set.status = owned.status;
      return { success: false, error: owned.error };
    }
  }

  const ipAddress = getClientIp(request);
  const result = await LicenseService.renew({
    licenseKey,
    additionalDays,
    days,
    newExpiresAt,
    isLifetime,
    actor: {
      type: isAdmin ? "ADMIN" : "BUILDER",
      id: builder?.id,
    },
    ipAddress,
  });

  if (!result.success) {
    set.status = result.notFound ? 404 : 400;
    return {
      success: false,
      error: result.error || "Gagal memperpanjang masa aktif lisensi",
    };
  }

  return {
    success: true,
    message: result.message,
    newExpiry: result.newExpiry,
    extendedDays: result.extendedDays,
    additionalDays: result.additionalDays,
    isLifetime: result.isLifetime,
    license: result.license,
  };
}

export async function handleListConfigs({
  query,
  request,
}: {
  query?: { mode?: "sandbox" | "live" };
  request?: { headers?: Headers };
}) {
  const headers = request?.headers;
  const { builder, isAdmin } = headers
    ? await resolveCurrentBuilder(headers)
    : { builder: null, isAdmin: true };

  const conditions: any[] = [];
  if (!isAdmin && builder) {
    conditions.push(eq(apps.builderId, builder.id));
  } else if (!isAdmin && !builder) {
    return { success: true, configs: [] };
  }

  if (query?.mode) {
    conditions.push(eq(apps.mode, query.mode));
  }

  const appRows = await db
    .select()
    .from(apps)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  if (appRows.length === 0) {
    return { success: true, configs: [] };
  }

  const appIds = appRows.map((a) => a.id);

  // Fetch all licenses belonging to these apps
  const licRows = await db.query.licenses.findMany({
    where: inArray(licenses.appId, appIds),
    orderBy: (lic, { desc }) => [desc(lic.createdAt)],
  });

  // Batch-fetch activations
  const licenseIds = licRows.map((l) => l.id);
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

  // Fetch LTV totals by app and customer
  const emails = [...new Set(licRows.map((l) => l.customerEmail.toLowerCase()))];
  const totals =
    licRows.length && emails.length
      ? await db
          .select({
            appId: transactions.appId,
            email: sql<string>`lower(${transactions.customerEmail})`,
            mode: transactions.mode,
            ltv: sql<number>`coalesce(sum(${transactions.grossAmount}),0)::bigint`,
          })
          .from(transactions)
          .where(
            and(
              inArray(transactions.appId, appIds),
              inArray(sql`lower(${transactions.customerEmail})`, emails),
              eq(transactions.paymentStatus, "PAID"),
              sql`${transactions.paymentChannel} IS DISTINCT FROM 'FREE_TRIAL'`
            )
          )
          .groupBy(transactions.appId, sql`lower(${transactions.customerEmail})`, transactions.mode)
      : [];

  const ltvMap = new Map(totals.map((r) => [`${r.mode}:${r.appId}:${r.email}`, Number(r.ltv)]));

  // Map licenses to app
  const licensesByApp = new Map<string, any[]>();
  for (const lic of licRows) {
    const enrichedLic = {
      ...lic,
      ltv: ltvMap.get(`${lic.mode}:${lic.appId}:${lic.customerEmail.toLowerCase()}`) || 0,
      seatsUsed: (activationsByLicense.get(lic.id) || []).length,
      activations: activationsByLicense.get(lic.id) || [],
    };
    const list = licensesByApp.get(lic.appId) || [];
    list.push(enrichedLic);
    licensesByApp.set(lic.appId, list);
  }

  const configs = appRows.map((app) => {
    const delivery = (app.deliveryConfig as any) || {};
    const lk = delivery.licenseKey;
    const appLicenses = licensesByApp.get(app.id) || [];
    const activeLicenses = appLicenses.filter((l) => l.status === "ACTIVE").length;
    const checkoutLicenses = appLicenses.filter((l) => Boolean(l.transactionId)).length;
    const manualLicenses = appLicenses.filter((l) => !l.transactionId).length;
    const totalLtv = appLicenses.reduce((acc, l) => acc + (l.ltv || 0), 0);

    return {
      id: app.id,
      appId: app.id,
      appName: app.name,
      mode: app.mode,
      name: lk?.description || `${app.name} License Configuration`,
      enabled: Boolean(lk?.enabled),
      maxSeats: lk?.maxSeats ?? 3,
      expiresInDays: lk?.expiresInDays ?? 365,
      offlineGraceDays: lk?.offlineGraceDays ?? 30,
      floating: lk?.floating || {
        enabled: false,
        leaseTtlSeconds: 300,
        heartbeatIntervalSeconds: 60,
      },
      defaultFeatures: lk?.defaultFeatures || {},
      totalLicenses: appLicenses.length,
      activeLicenses,
      checkoutLicenses,
      manualLicenses,
      totalLtv,
      licenses: appLicenses,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    };
  });

  return {
    success: true,
    configs,
  };
}

export async function handleSaveConfig({
  body,
  request,
  set,
}: {
  body: {
    appId: string;
    name?: string;
    enabled?: boolean;
    maxSeats?: number;
    expiresInDays?: number | null;
    offlineGraceDays?: number;
    floating?: {
      enabled?: boolean;
      leaseTtlSeconds?: number;
      heartbeatIntervalSeconds?: number;
    };
    defaultFeatures?: Record<string, any>;
  };
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

  if (!isAdmin && builder) {
    const owned = await verifyOwnedApp(builder.id, body.appId, isAdmin);
    if ("error" in owned) {
      if (set) set.status = owned.status;
      return { success: false, error: owned.error };
    }
  }

  const existingApp = await db.query.apps.findFirst({
    where: eq(apps.id, body.appId),
  });

  if (!existingApp) {
    if (set) set.status = 404;
    return { success: false, error: "Aplikasi/Project tidak ditemukan" };
  }

  const existingDelivery = (existingApp.deliveryConfig as any) || {};
  const currentLicenseKey = existingDelivery.licenseKey || {};

  const updatedLicenseKey = {
    ...currentLicenseKey,
    enabled: body.enabled !== undefined ? body.enabled : true,
    description:
      body.name || currentLicenseKey.description || `${existingApp.name} License Configuration`,
    maxSeats:
      body.maxSeats !== undefined ? Number(body.maxSeats) : (currentLicenseKey.maxSeats ?? 3),
    expiresInDays:
      body.expiresInDays !== undefined
        ? body.expiresInDays === null
          ? undefined
          : Number(body.expiresInDays)
        : currentLicenseKey.expiresInDays,
    offlineGraceDays:
      body.offlineGraceDays !== undefined
        ? Number(body.offlineGraceDays)
        : (currentLicenseKey.offlineGraceDays ?? 30),
    floating: body.floating !== undefined ? body.floating : currentLicenseKey.floating,
    defaultFeatures:
      body.defaultFeatures !== undefined
        ? body.defaultFeatures
        : currentLicenseKey.defaultFeatures || {},
  };

  const updatedDelivery = {
    ...existingDelivery,
    licenseKey: updatedLicenseKey,
  };

  await db
    .update(apps)
    .set({
      deliveryConfig: updatedDelivery,
      updatedAt: new Date(),
    })
    .where(eq(apps.id, body.appId));

  return {
    success: true,
    message: "Pengaturan lisensi berhasil disimpan",
    config: {
      id: existingApp.id,
      appId: existingApp.id,
      appName: existingApp.name,
      mode: existingApp.mode,
      name: updatedLicenseKey.description,
      enabled: updatedLicenseKey.enabled,
      maxSeats: updatedLicenseKey.maxSeats,
      expiresInDays: updatedLicenseKey.expiresInDays,
      offlineGraceDays: updatedLicenseKey.offlineGraceDays,
      floating: updatedLicenseKey.floating,
      defaultFeatures: updatedLicenseKey.defaultFeatures,
    },
  };
}
