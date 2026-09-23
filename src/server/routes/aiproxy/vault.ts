import { db } from "../../db";
import { aiVaultCredentials, apps } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { CryptoService } from "../../services/crypto";
import { resolveCurrentBuilder } from "../apps/builder";
import { verifyOwnedApp } from "../../lib/ownership";

/**
 * Helper untuk menyimpan kredensial ke Vault dengan AES-256-GCM
 */
export async function saveVaultCredential(body: any, set: any, request?: any) {
  const { appId, provider, rawApiKey, monthlyBudgetLimit = 500000 } = body;

  const { builder, isAdmin } = request?.headers
    ? await resolveCurrentBuilder(request.headers)
    : !request
      ? { builder: null, isAdmin: true }
      : { builder: null, isAdmin: false };

  if (!isAdmin && !builder) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  if (!isAdmin && builder) {
    const owned = await verifyOwnedApp(builder.id, appId, isAdmin);
    if ("error" in owned) {
      set.status = owned.status;
      return { error: owned.error };
    }
  }

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
  });

  if (!app) {
    set.status = 404;
    return { error: "App not found" };
  }

  // Enkripsi API Key dengan AES-256-GCM
  const { cipherText, iv, authTag } = CryptoService.encrypt(rawApiKey);

  const existing = await db.query.aiVaultCredentials.findFirst({
    where: and(eq(aiVaultCredentials.appId, appId), eq(aiVaultCredentials.provider, provider)),
  });

  if (existing) {
    await db
      .update(aiVaultCredentials)
      .set({
        encryptedApiKey: cipherText,
        iv,
        authTag,
        monthlyBudgetLimit,
        updatedAt: new Date(),
      })
      .where(eq(aiVaultCredentials.id, existing.id));
  } else {
    await db.insert(aiVaultCredentials).values({
      appId,
      provider,
      encryptedApiKey: cipherText,
      iv,
      authTag,
      monthlyBudgetLimit,
    });
  }

  return {
    success: true,
    message: `API Key untuk ${provider} berhasil diamankan di Vault (AES-256-GCM).`,
  };
}

/**
 * Cek status Vault Kredensial AI untuk suatu App
 */
export async function handleGetVaultCredentials({ params: { appId }, request, set }: any) {
  const { builder, isAdmin } = request?.headers
    ? await resolveCurrentBuilder(request.headers)
    : !request
      ? { builder: null, isAdmin: true }
      : { builder: null, isAdmin: false };

  if (!isAdmin && !builder) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  if (!isAdmin && builder) {
    const owned = await verifyOwnedApp(builder.id, appId, isAdmin);
    if ("error" in owned) {
      set.status = owned.status;
      return { error: owned.error };
    }
  }

  const creds = await db.query.aiVaultCredentials.findMany({
    where: eq(aiVaultCredentials.appId, appId),
  });

  const sanitized = creds.map((c) => ({
    id: c.id,
    appId: c.appId,
    provider: c.provider,
    monthlyBudgetLimit: c.monthlyBudgetLimit,
    currentMonthlyUsage: c.currentMonthlyUsage,
    isKillSwitchActive: c.isKillSwitchActive,
    updatedAt: c.updatedAt,
  }));

  return {
    success: true,
    credentials: sanitized,
  };
}

/**
 * Toggle Kill-Switch
 */
export async function handleToggleKillSwitch({ body, request, set }: any) {
  const { appId, provider } = body as any;

  const { builder, isAdmin } = request?.headers
    ? await resolveCurrentBuilder(request.headers)
    : !request
      ? { builder: null, isAdmin: true }
      : { builder: null, isAdmin: false };

  if (!isAdmin && !builder) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  if (!isAdmin && builder) {
    const owned = await verifyOwnedApp(builder.id, appId, isAdmin);
    if ("error" in owned) {
      set.status = owned.status;
      return { error: owned.error };
    }
  }

  const cred = await db.query.aiVaultCredentials.findFirst({
    where: and(eq(aiVaultCredentials.appId, appId), eq(aiVaultCredentials.provider, provider)),
  });

  if (!cred) {
    set.status = 404;
    return { error: "Vault credentials not found for this provider" };
  }

  const nextStatus = !cred.isKillSwitchActive;
  const [updated] = await db
    .update(aiVaultCredentials)
    .set({
      isKillSwitchActive: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(aiVaultCredentials.id, cred.id))
    .returning();

  return {
    success: true,
    isKillSwitchActive: updated.isKillSwitchActive,
    message: updated.isKillSwitchActive
      ? `Kill switch AKTIF. Seluruh panggilan AI ke ${provider} diblokir sementara.`
      : `Kill switch NON-AKTIF. Panggilan AI ke ${provider} kembali normal.`,
  };
}
