import { db } from "../../db";
import { apps, builders, transactions, licenses } from "../../db/schema";
import { eq, desc, sql, count } from "drizzle-orm";

/**
 * Direktori Semua Aplikasi / Software di Seluruh Platform (Super Admin)
 */
export async function handlePanelApps({ query }: any) {
  const limit = Math.min(Number(query?.limit) || 100, 500);
  const modeFilter = query?.mode;
  const statusFilter = query?.status;

  const allApps = await db.query.apps.findMany({
    orderBy: [desc(apps.createdAt)],
    limit,
  });

  const [allBuilders, licenseCounts, paidTxs] = await Promise.all([
    db.select({ id: builders.id, name: builders.name, email: builders.email }).from(builders),
    db
      .select({
        appId: licenses.appId,
        count: count(),
      })
      .from(licenses)
      .groupBy(licenses.appId),
    db
      .select({
        appId: transactions.appId,
        grossAmount: transactions.grossAmount,
      })
      .from(transactions)
      .where(eq(transactions.paymentStatus, "PAID")),
  ]);

  const builderMap = new Map(allBuilders.map((b) => [b.id, b]));
  const licenseMap = new Map(licenseCounts.map((l) => [l.appId, Number(l.count)]));

  const gmvMap = new Map<string, number>();
  for (const tx of paidTxs) {
    gmvMap.set(tx.appId, (gmvMap.get(tx.appId) || 0) + tx.grossAmount);
  }

  let enriched = allApps.map((a) => {
    const builder = builderMap.get(a.builderId);
    return {
      id: a.id,
      name: a.name,
      slug: a.slug,
      builderId: a.builderId,
      builderName: builder?.name || "Unknown Builder",
      builderEmail: builder?.email || "-",
      mode: a.mode,
      isSuspended: a.isSuspended,
      targetPrice: a.targetPrice,
      pricingType: a.pricingType,
      licenseCount: licenseMap.get(a.id) || 0,
      totalGMV: gmvMap.get(a.id) || 0,
      deliveryType: a.deliveryConfig?.licenseKey?.enabled
        ? "license_key"
        : a.deliveryConfig?.fileDownload?.enabled
          ? "file_download"
          : a.deliveryConfig?.apiAccess?.enabled
            ? "api_access"
            : "other",
      createdAt: a.createdAt,
    };
  });

  if (modeFilter) {
    enriched = enriched.filter((a) => a.mode === modeFilter);
  }

  if (statusFilter === "suspended") {
    enriched = enriched.filter((a) => a.isSuspended);
  } else if (statusFilter === "active") {
    enriched = enriched.filter((a) => !a.isSuspended);
  }

  return {
    success: true,
    total: enriched.length,
    apps: enriched,
  };
}
