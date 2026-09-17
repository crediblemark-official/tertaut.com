import { db } from "../../db";
import { transactions, builders, apps } from "../../db/schema";
import { eq, inArray } from "drizzle-orm";

/**
 * Ledger Transaksi Global (Audit Cross-Builder)
 */
export async function handlePanelTransactions({ query }: any) {
  const limit = Number(query.limit) || 100;
  const statusFilter = query.status;

  const whereClause = statusFilter
    ? eq(transactions.paymentStatus, statusFilter as any)
    : undefined;

  const allTxs = await db.query.transactions.findMany({
    where: whereClause,
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit,
  });

  // Batch-lookup app & builder (hindari N+1 per baris ledger).
  const appIds = [...new Set(allTxs.map((tx) => tx.appId))];
  const builderIds = [...new Set(allTxs.map((tx) => tx.builderId))];

  const [appRows, builderRows] = await Promise.all([
    appIds.length
      ? db.query.apps.findMany({ where: inArray(apps.id, appIds) })
      : Promise.resolve([] as (typeof apps.$inferSelect)[]),
    builderIds.length
      ? db.query.builders.findMany({ where: inArray(builders.id, builderIds) })
      : Promise.resolve([] as (typeof builders.$inferSelect)[]),
  ]);

  const appNameById = new Map(appRows.map((a) => [a.id, a.name]));
  const builderEmailById = new Map(builderRows.map((b) => [b.id, b.email]));

  const enriched = allTxs.map((tx) => ({
    id: tx.id,
    appId: tx.appId,
    appName: appNameById.get(tx.appId) || tx.appId,
    builderId: tx.builderId,
    builderEmail: builderEmailById.get(tx.builderId) || "builder@tertaut.com",
    customerEmail: tx.customerEmail,
    grossAmount: tx.grossAmount,
    platformFee: tx.platformFee,
    netAmount: tx.netAmount,
    paymentStatus: tx.paymentStatus,
    disbursementStatus: tx.disbursementStatus,
    paymentChannel: tx.paymentChannel,
    paidAt: tx.paidAt,
    createdAt: tx.createdAt,
  }));

  return {
    success: true,
    count: enriched.length,
    total: enriched.length,
    transactions: enriched,
  };
}
