import { db } from "../../db";
import { apps, aiAppConfigs, aiProviderKeys } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { resolveCurrentBuilder } from "../apps/builder";
import { verifyOwnedApp } from "../../lib/ownership";

/**
 * Ambil konfigurasi model & guardrails aplikasi
 */
export async function handleGetAppConfigs({ params: { appId }, request, set }: any) {
  const { builder, isAdmin } = request?.headers
    ? await resolveCurrentBuilder(request.headers)
    : !request
      ? { builder: null, isAdmin: true }
      : { builder: null, isAdmin: false };

  if (!isAdmin && !builder) {
    set.status = 401;
    return { success: false, error: "Unauthorized" };
  }

  if (!isAdmin && builder) {
    const owned = await verifyOwnedApp(builder.id, appId, isAdmin);
    if ("error" in owned) {
      set.status = owned.status;
      return { success: false, error: owned.error };
    }
  }

  const configs = await db.query.aiAppConfigs.findMany({
    where: eq(aiAppConfigs.appId, appId),
  });
  return { success: true, configs };
}

/**
 * Simpan / perbarui konfigurasi model & guardrails aplikasi
 */
export async function handleSaveAppConfig({ body, request, set }: any) {
  const {
    appId,
    modelAlias,
    targetModelName,
    maxRequestsPerMin = 15,
    dailyTokenLimit = 100000,
    monthlyBudgetIdr = 500000,
    providerKeyId,
  } = body as any;

  const { builder, isAdmin } = request?.headers
    ? await resolveCurrentBuilder(request.headers)
    : !request
      ? { builder: null, isAdmin: true }
      : { builder: null, isAdmin: false };

  if (!isAdmin && !builder) {
    set.status = 401;
    return { success: false, error: "Unauthorized" };
  }

  if (!isAdmin && builder) {
    const owned = await verifyOwnedApp(builder.id, appId, isAdmin);
    if ("error" in owned) {
      set.status = owned.status;
      return { success: false, error: owned.error };
    }
  }

  const app = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
  if (!app) {
    set.status = 404;
    return { success: false, error: "App not found" };
  }

  // BUG B8: providerKeyId tidak boleh menunjuk key milik builder lain (IDOR).
  // Verifikasi kepemilikan pada saat penyimpanan, dan chat.ts memverifikasi lagi
  // pada saat eksekusi.
  if (providerKeyId) {
    const pk = await db.query.aiProviderKeys.findFirst({
      where: and(eq(aiProviderKeys.id, providerKeyId), eq(aiProviderKeys.builderId, app.builderId)),
    });
    if (!pk) {
      set.status = 400;
      return {
        success: false,
        error: "providerKeyId tidak valid: key bukan milik builder aplikasi ini.",
      };
    }
  }

  const existing = await db.query.aiAppConfigs.findFirst({
    where: and(eq(aiAppConfigs.appId, appId), eq(aiAppConfigs.modelAlias, modelAlias)),
  });

  if (existing) {
    await db
      .update(aiAppConfigs)
      .set({
        targetModelName,
        maxRequestsPerMin,
        dailyTokenLimit,
        monthlyBudgetIdr,
        providerKeyId: providerKeyId || null,
      })
      .where(eq(aiAppConfigs.id, existing.id));
  } else {
    await db.insert(aiAppConfigs).values({
      id: `cfg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      appId,
      modelAlias,
      targetModelName,
      maxRequestsPerMin,
      dailyTokenLimit,
      monthlyBudgetIdr,
      providerKeyId: providerKeyId || null,
    });
  }

  return { success: true, message: `Model config '${modelAlias}' berhasil disimpan.` };
}
