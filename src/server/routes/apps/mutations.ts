import { db } from "../../db";
import { apps, builders } from "../../db/schema";
import type { DeliveryConfig, MeteringConfig, CaptureConfig } from "../../db/schema/apps";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { resolveCurrentBuilder } from "./builder";
import { generateAppApiKey, generateBuilderSecretApiKey } from "./api-key";

export interface CreateAppBody {
  name: string;
  slug: string;
  targetPrice: number;
  mode?: "sandbox" | "live";
  description?: string | null;
  headline?: string | null;
  subheadline?: string | null;
  mediaUrl?: string | null;
  valueProps?: string[];
  ctaText?: string;
  customIntentMessage?: string | null;
  captureConfig?: CaptureConfig | null;
  redirectUrl?: string | null;
  pricingType?: "one_time" | "subscription" | "free";
  billingPeriod?: string | null;
  trialPeriodDays?: number | null;
  deliveryConfig?: DeliveryConfig | null;
  meteringConfig?: MeteringConfig | null;
}

export interface UpdateAppBody extends Partial<CreateAppBody> {
  pageBlocks?: unknown;
  customHtml?: string | null;
}

interface CreateAppContext {
  body: CreateAppBody;
  set: { status?: number | string };
  request: { headers: Headers };
}

interface UpdateAppContext {
  params: { appId: string };
  body: UpdateAppBody;
  set: { status?: number | string };
  request: { headers: Headers };
}

interface AppIdParamContext {
  params: { appId: string };
  set: { status?: number | string };
  request: { headers: Headers };
}

interface UpdateModeContext {
  params: { appId: string };
  body: { mode: "sandbox" | "live" };
  set: { status?: number | string };
  request: { headers: Headers };
}

interface RotateSecretContext {
  request: { headers: Headers };
  set: { status?: number | string };
}

/**
 * Buat Kampanye / Aplikasi Baru (FR-1.1 & FR-1.3)
 */
export async function handleCreateApp({ body, set, request: { headers } }: CreateAppContext) {
  const {
    name,
    slug,
    targetPrice,
    mode = "sandbox",
    description,
    headline,
    subheadline,
    mediaUrl,
    valueProps,
    ctaText = "Beli Sekarang",
    customIntentMessage,
    captureConfig,
    redirectUrl,
    pricingType = "one_time",
    billingPeriod,
    trialPeriodDays,
    deliveryConfig,
    meteringConfig,
  } = body;

  const { builder } = await resolveCurrentBuilder(headers);
  if (!builder) {
    set.status = 400;
    return { error: "Profil builder tidak ditemukan untuk akun Anda." };
  }

  // Pastikan slug unik
  const existingApp = await db.query.apps.findFirst({
    where: eq(apps.slug, slug),
  });
  if (existingApp) {
    set.status = 409;
    return { error: `Slug "${slug}" sudah digunakan. Gunakan slug lain.` };
  }

  const appId = `app_${randomBytes(6).toString("hex")}`;

  const [newApp] = await db
    .insert(apps)
    .values({
      id: appId,
      builderId: builder.id,
      apiKey: generateAppApiKey(mode),
      name,
      slug,
      targetPrice,
      mode,
      pricingType,
      billingPeriod: billingPeriod || null,
      trialPeriodDays: typeof trialPeriodDays === "number" ? trialPeriodDays : 0,
      deliveryConfig: deliveryConfig || null,
      meteringConfig: meteringConfig || null,
      description: description || null,
      headline: headline || name,
      subheadline: subheadline || description || null,
      mediaUrl: mediaUrl || null,
      valueProps: valueProps || [],
      ctaText: ctaText || "Beli Sekarang",
      customIntentMessage: customIntentMessage || null,
      captureConfig: captureConfig || null,
      redirectUrl: redirectUrl || null,
    })
    .returning();

  return { success: true, app: newApp };
}

/**
 * Perbarui Konfigurasi Kampanye / Aplikasi (FR-1.1 & FR-1.3)
 */
export async function handleUpdateApp({ params: { appId }, body, set, request: { headers } }: UpdateAppContext) {
  const { builder, isAdmin } = await resolveCurrentBuilder(headers);
  const existing = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
  });

  if (!existing) {
    set.status = 404;
    return { error: "App not found" };
  }

  if (builder && existing.builderId !== builder.id && !isAdmin) {
    set.status = 403;
    return { error: "Forbidden: Anda tidak memiliki hak akses mengubah aplikasi ini" };
  }

  // Jika ada perubahan slug, pastikan slug tidak bentrok dengan app lain
  if (body.slug && body.slug !== existing.slug) {
    const slugClash = await db.query.apps.findFirst({
      where: eq(apps.slug, body.slug),
    });
    if (slugClash) {
      set.status = 409;
      return { error: `Slug "${body.slug}" sudah digunakan.` };
    }
  }

  // Explicit allowlist to prevent mass-assignment/field pollution
  const {
    name, slug, targetPrice, mode, description, headline, subheadline,
    mediaUrl, valueProps, ctaText, customIntentMessage, redirectUrl,
    pageBlocks, customHtml, captureConfig,
    pricingType, billingPeriod, trialPeriodDays, deliveryConfig, meteringConfig
  } = body as Record<string, any>;

  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (name !== undefined) updateData.name = name;
  if (slug !== undefined) updateData.slug = slug;
  if (targetPrice !== undefined) updateData.targetPrice = targetPrice;
  if (mode !== undefined) updateData.mode = mode;
  if (pricingType !== undefined) updateData.pricingType = pricingType;
  if (billingPeriod !== undefined) updateData.billingPeriod = billingPeriod;
  if (trialPeriodDays !== undefined) updateData.trialPeriodDays = trialPeriodDays;
  if (deliveryConfig !== undefined) updateData.deliveryConfig = deliveryConfig;
  if (meteringConfig !== undefined) updateData.meteringConfig = meteringConfig;
  if (description !== undefined) updateData.description = description;
  if (headline !== undefined) updateData.headline = headline;
  if (subheadline !== undefined) updateData.subheadline = subheadline;
  if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl;
  if (valueProps !== undefined) updateData.valueProps = valueProps;
  if (ctaText !== undefined) updateData.ctaText = ctaText;
  if (customIntentMessage !== undefined) updateData.customIntentMessage = customIntentMessage;
  if (redirectUrl !== undefined) updateData.redirectUrl = redirectUrl;
  if (pageBlocks !== undefined) updateData.pageBlocks = pageBlocks;
  if (customHtml !== undefined) updateData.customHtml = customHtml;
  if (captureConfig !== undefined) updateData.captureConfig = captureConfig;

  const [updated] = await db
    .update(apps)
    .set(updateData)
    .where(eq(apps.id, appId))
    .returning();

  return { success: true, app: updated };
}

/**
 * Hapus Kampanye / Aplikasi (FR-1.1)
 */
export async function handleDeleteApp({ params: { appId }, set, request: { headers } }: AppIdParamContext) {
  const { builder, isAdmin } = await resolveCurrentBuilder(headers);
  const existing = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
  });

  if (!existing) {
    set.status = 404;
    return { error: "App not found" };
  }

  if (builder && existing.builderId !== builder.id && !isAdmin) {
    set.status = 403;
    return { error: "Forbidden: Anda tidak memiliki hak akses menghapus aplikasi ini" };
  }

  await db.delete(apps).where(eq(apps.id, appId));

  return { success: true, message: `Kampanye "${existing.name}" berhasil dihapus.` };
}

/**
 * Perbarui status mode aplikasi (sandbox <-> live)
 */
export async function handleUpdateMode({ params: { appId }, body: { mode }, set, request: { headers } }: UpdateModeContext) {
  const { builder, isAdmin } = await resolveCurrentBuilder(headers);
  const currentApp = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
  });

  if (!currentApp) {
    set.status = 404;
    return { error: "App not found" };
  }

  if (builder && currentApp.builderId !== builder.id && !isAdmin) {
    set.status = 403;
    return { error: "Forbidden: Anda tidak memiliki hak akses mengubah mode aplikasi ini" };
  }

  const [updated] = await db
    .update(apps)
    .set({ mode, apiKey: generateAppApiKey(mode), updatedAt: new Date() })
    .where(eq(apps.id, appId))
    .returning();

  return { success: true, app: updated };
}

/**
 * Rotasi (regenerate) publishable API key aplikasi (pola publishable-key ala creem.io)
 */
export async function handleRotateApiKey({ params: { appId }, set, request: { headers } }: AppIdParamContext) {
  const { builder, isAdmin } = await resolveCurrentBuilder(headers);
  const existing = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
  });

  if (!existing) {
    set.status = 404;
    return { error: "App not found" };
  }

  if (builder && existing.builderId !== builder.id && !isAdmin) {
    set.status = 403;
    return { error: "Forbidden: Anda tidak memiliki hak akses aplikasi ini" };
  }

  const [updated] = await db
    .update(apps)
    .set({ apiKey: generateAppApiKey(existing.mode), updatedAt: new Date() })
    .where(eq(apps.id, appId))
    .returning();

  return { success: true, app: updated };
}

/**
 * Rotasi secret API key builder (server-to-server). Hanya sesi dashboard owner.
 */
export async function handleRotateBuilderSecret({ request: { headers }, set }: RotateSecretContext) {
  const { builder } = await resolveCurrentBuilder(headers);

  if (!builder) {
    set.status = 400;
    return { error: "Profil builder tidak ditemukan untuk akun Anda." };
  }

  const secretApiKey = generateBuilderSecretApiKey();
  const [updated] = await db
    .update(builders)
    .set({ secretApiKey, updatedAt: new Date() })
    .where(eq(builders.id, builder.id))
    .returning();

  if (!updated) {
    set.status = 404;
    return { error: "Profil builder tidak ditemukan." };
  }

  return { success: true, secretApiKey: updated.secretApiKey, builderId: updated.id };
}
