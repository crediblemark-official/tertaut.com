import { db } from "../../db";
import { apps, transactions, licenses } from "../../db/schema";
import { eq, desc, count, sql, and, inArray } from "drizzle-orm";
import { config as appConfig } from "../../config";
import { resolveCurrentBuilder, seedSandboxBuilderIfNeeded } from "./builder";

/**
 * Ambil daftar aplikasi (scoped ke builder pemilik kecuali admin)
 */
export async function handleListApps({ query, request: { headers } }: any) {
  const { builder, isAdmin } = await resolveCurrentBuilder(headers);

  // Auto-seed builder & sample app HANYA di mode sandbox (development)
  if (appConfig.isSandbox && !builder) {
    await seedSandboxBuilderIfNeeded();
  }

  const conditions: any[] = [];
  if (query.mode) {
    conditions.push(eq(apps.mode, query.mode));
  }
  if (builder && !isAdmin) {
    conditions.push(eq(apps.builderId, builder.id));
  }

  const allApps = await db.query.apps.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(apps.createdAt)],
  });

  return { apps: allApps };
}

/**
 * Ambil ringkasan KPI Dashboard (GMV, Lisensi Aktif, Validasi Konversi)
 */
export async function handleStatsOverview({ query, request: { headers } }: any) {
  const emptyStats = {
    totalGMV: 0,
    netEarnings: 0,
    platformFeeCollected: 0,
    activeLicenses: 0,
    totalTransactions: 0,
  };

  const { builder, isAdmin } = await resolveCurrentBuilder(headers);

  const appConditions: any[] = [];
  if (query.mode) {
    appConditions.push(eq(apps.mode, query.mode));
  }
  if (builder && !isAdmin) {
    appConditions.push(eq(apps.builderId, builder.id));
  }

  let appIds: string[] | null = null;
  if (appConditions.length > 0) {
    const rows = await db
      .select({ id: apps.id })
      .from(apps)
      .where(and(...appConditions));
    appIds = rows.map((r) => r.id);
    if (appIds.length === 0) return emptyStats;
  }

  const txScope = appIds ? inArray(transactions.appId, appIds) : undefined;
  const licenseScope = appIds ? inArray(licenses.appId, appIds) : undefined;

  const [allTxCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(txScope);

  const [paidTxAgg] = await db
    .select({
      totalGMV: sql<number>`COALESCE(SUM(${transactions.grossAmount}), 0)::int`,
      netEarnings: sql<number>`COALESCE(SUM(${transactions.netAmount}), 0)::int`,
    })
    .from(transactions)
    .where(txScope ? and(eq(transactions.paymentStatus, "PAID"), txScope) : eq(transactions.paymentStatus, "PAID"));

  const [activeLicensesCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(licenses)
    .where(licenseScope ? and(eq(licenses.status, "ACTIVE"), licenseScope) : eq(licenses.status, "ACTIVE"));

  const totalGMV = paidTxAgg?.totalGMV || 0;
  const netEarnings = paidTxAgg?.netEarnings || 0;
  const activeLicenses = activeLicensesCount?.count || 0;

  return {
    totalGMV,
    netEarnings,
    platformFeeCollected: totalGMV - netEarnings,
    activeLicenses,
    totalTransactions: allTxCount?.count || 0,
  };
}

/**
 * Ambil KPI ringkasan Katalog Produk riil dari DB (Active Products, Sales 30d, Subscriptions, Customers 30d)
 */
export async function handleStatsCatalog({ query, request: { headers } }: any) {
  const emptyStats = {
    activeProducts: 0,
    archivedProducts: 0,
    sales30d: 0,
    activeSubscriptions: 0,
    acrossProducts: 0,
    customers30d: 0,
  };

  const { builder, isAdmin } = await resolveCurrentBuilder(headers);

  const appConditions: any[] = [];
  if (query.mode) {
    appConditions.push(eq(apps.mode, query.mode));
  }
  if (builder && !isAdmin) {
    appConditions.push(eq(apps.builderId, builder.id));
  }

  const appRows = await db
    .select({ id: apps.id, pricingType: apps.pricingType })
    .from(apps)
    .where(appConditions.length > 0 ? and(...appConditions) : undefined);

  const appIds = appRows.map((r) => r.id);
  if (appIds.length === 0) return emptyStats;

  const txScope = inArray(transactions.appId, appIds);
  const licenseScope = inArray(licenses.appId, appIds);

  const [txAgg] = await db
    .select({
      sales30d: sql<number>`count(*)::int`,
      customers30d: sql<number>`count(distinct ${transactions.customerEmail})::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.paymentStatus, "PAID"),
        sql`${transactions.createdAt} >= NOW() - INTERVAL '30 days'`,
        txScope
      )
    );

  // R2: Filter active subscriptions hanya dari produk yang bertipe subscription
  const subAppIds = appRows
    .filter((a) => a.pricingType === "subscription")
    .map((a) => a.id);
  const subLicenseScope =
    subAppIds.length > 0 ? inArray(licenses.appId, subAppIds) : sql`1 = 0`;

  const [licAgg] = await db
    .select({
      activeSubs: sql<number>`count(*)::int`,
      acrossProducts: sql<number>`count(distinct ${licenses.appId})::int`,
    })
    .from(licenses)
    .where(and(eq(licenses.status, "ACTIVE"), subLicenseScope));

  return {
    activeProducts: appIds.length,
    archivedProducts: 0,
    sales30d: txAgg?.sales30d || 0,
    activeSubscriptions: licAgg?.activeSubs || 0,
    acrossProducts: licAgg?.acrossProducts || 0,
    customers30d: txAgg?.customers30d || 0,
  };
}

/**
 * Cek ketersediaan slug unik secara real-time (FR-1.2)
 */
export async function handleCheckSlug({ params: { slug } }: any) {
  const existing = await db.query.apps.findFirst({
    where: eq(apps.slug, slug),
  });
  return { slug, available: !existing };
}

/**
 * Ambil detail publik aplikasi berdasarkan slug (URL /pay/:slug)
 */
export async function handleGetBySlug({ params: { slug }, set }: any) {
  const app = await db.query.apps.findFirst({
    where: eq(apps.slug, slug),
  });

  if (!app) {
    set.status = 404;
    return { error: "Product not found" };
  }

  return {
    id: app.id,
    name: app.name,
    slug: app.slug,
    mode: app.mode,
    targetPrice: app.targetPrice,
    description: app.description,
    headline: app.headline || app.name,
    subheadline: app.subheadline || app.description,
    mediaUrl: app.mediaUrl,
    valueProps: app.valueProps || [],
    ctaText: app.ctaText || "Beli Sekarang",
    customIntentMessage: app.customIntentMessage || "Aplikasi dalam persiapan rilis. Masukkan email untuk diskon 50%!",
    pageBlocks: app.pageBlocks || null,
    redirectUrl: app.redirectUrl,
  };
}
