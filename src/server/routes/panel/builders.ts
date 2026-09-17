import { db } from "../../db";
import { transactions, builders, apps } from "../../db/schema";
import { eq } from "drizzle-orm";

/**
 * Direktori Builder & Rekening Pencairan
 */
export async function handlePanelBuilders() {
  const allBuilders = await db.query.builders.findMany({
    orderBy: (b, { desc }) => [desc(b.createdAt)],
  });

  // Ambil semua app & transaksi PAID sekali, lalu kelompokkan per builder
  // (menghindari N+1 query per builder).
  const [allApps, paidTxs] = await Promise.all([
    db
      .select({
        id: apps.id,
        name: apps.name,
        slug: apps.slug,
        mode: apps.mode,
        builderId: apps.builderId,
      })
      .from(apps),
    db
      .select({
        builderId: transactions.builderId,
        grossAmount: transactions.grossAmount,
        netAmount: transactions.netAmount,
        disbursementStatus: transactions.disbursementStatus,
      })
      .from(transactions)
      .where(eq(transactions.paymentStatus, "PAID")),
  ]);

  const appsByBuilder = new Map<string, typeof allApps>();
  for (const a of allApps) {
    const list = appsByBuilder.get(a.builderId) || [];
    list.push(a);
    appsByBuilder.set(a.builderId, list);
  }

  const txsByBuilder = new Map<string, typeof paidTxs>();
  for (const tx of paidTxs) {
    const list = txsByBuilder.get(tx.builderId) || [];
    list.push(tx);
    txsByBuilder.set(tx.builderId, list);
  }

  const enriched = allBuilders.map((b) => {
    const builderApps = appsByBuilder.get(b.id) || [];
    const builderTxs = txsByBuilder.get(b.id) || [];

    const gmv = builderTxs.reduce((sum, tx) => sum + tx.grossAmount, 0);
    const net = builderTxs.reduce((sum, tx) => sum + tx.netAmount, 0);
    const pending = builderTxs
      .filter((tx) => tx.disbursementStatus === "PENDING")
      .reduce((sum, tx) => sum + tx.netAmount, 0);

    return {
      id: b.id,
      name: b.name,
      email: b.email,
      disbursementAccount: b.disbursementAccount || null,
      bankAccount: b.disbursementAccount
        ? {
            bankName: b.disbursementAccount.bankCode || null,
            accountNumber: b.disbursementAccount.accountNumber || null,
            accountHolder: b.disbursementAccount.accountHolderName || b.name,
          }
        : null,
      totalApps: builderApps.length,
      appCount: builderApps.length,
      apps: builderApps.map((a) => ({ id: a.id, name: a.name, slug: a.slug, mode: a.mode })),
      totalGMV: gmv,
      totalSales: gmv,
      totalNetEarnings: net,
      builderNetRevenue: net,
      pendingPayout: pending,
      createdAt: b.createdAt,
    };
  });

  return {
    success: true,
    count: enriched.length,
    total: enriched.length,
    builders: enriched,
  };
}
