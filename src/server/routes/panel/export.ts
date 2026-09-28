import { db } from "../../db";
import { transactions, builders, apps, licenses } from "../../db/schema";
import { eq, inArray, desc } from "drizzle-orm";

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsvField).join(",") + "\r\n";
}

/**
 * Ekspor Ledger Transaksi Global ke format CSV (RFC 4180 + UTF-8 BOM)
 */
export async function handleExportTransactions({ query, set }: any) {
  const statusFilter = query?.status;
  const whereClause = statusFilter
    ? eq(transactions.paymentStatus, statusFilter as any)
    : undefined;

  const allTxs = await db.query.transactions.findMany({
    where: whereClause,
    orderBy: [desc(transactions.createdAt)],
    limit: 10000,
  });

  const appIds = [...new Set(allTxs.map((t) => t.appId))];
  const builderIds = [...new Set(allTxs.map((t) => t.builderId))];

  const [appRows, builderRows] = await Promise.all([
    appIds.length
      ? db.query.apps.findMany({ where: inArray(apps.id, appIds) })
      : Promise.resolve([]),
    builderIds.length
      ? db.query.builders.findMany({ where: inArray(builders.id, builderIds) })
      : Promise.resolve([]),
  ]);

  const appNameMap = new Map(appRows.map((a) => [a.id, a.name]));
  const builderEmailMap = new Map(builderRows.map((b) => [b.id, b.email]));

  const headers = [
    "ID Transaksi",
    "Aplikasi",
    "Email Builder",
    "Email Pembeli",
    "Gross Amount (IDR)",
    "Platform Fee 5% (IDR)",
    "Net Builder 95% (IDR)",
    "Kanal Pembayaran",
    "Status Pembayaran",
    "Status Pencairan",
    "Kupon",
    "Diskon (IDR)",
    "Waktu Dibayar",
    "Waktu Dibuat",
  ];

  let csv = "\uFEFF" + toCsvRow(headers);

  for (const tx of allTxs) {
    csv += toCsvRow([
      tx.id,
      appNameMap.get(tx.appId) || tx.appId,
      builderEmailMap.get(tx.builderId) || tx.builderId,
      tx.customerEmail,
      tx.grossAmount,
      tx.platformFee,
      tx.netAmount,
      tx.paymentChannel || "DANA",
      tx.paymentStatus,
      tx.disbursementStatus,
      tx.couponCode || "",
      tx.discountAmount || 0,
      tx.paidAt ? tx.paidAt.toISOString() : "",
      tx.createdAt.toISOString(),
    ]);
  }

  const dateStr = new Date().toISOString().split("T")[0];
  set.headers["Content-Type"] = "text/csv; charset=utf-8";
  set.headers["Content-Disposition"] = `attachment; filename="tertaut-transactions-${dateStr}.csv"`;

  return csv;
}

/**
 * Ekspor Direktori Builder & Rekening Pencairan ke format CSV (RFC 4180 + UTF-8 BOM)
 */
export async function handleExportBuilders({ set }: any) {
  const allBuilders = await db.query.builders.findMany({
    orderBy: [desc(builders.createdAt)],
  });

  const [allApps, paidTxs] = await Promise.all([
    db.select({ id: apps.id, builderId: apps.builderId }).from(apps),
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

  const appsCountByBuilder = new Map<string, number>();
  for (const a of allApps) {
    appsCountByBuilder.set(a.builderId, (appsCountByBuilder.get(a.builderId) || 0) + 1);
  }

  const txsByBuilder = new Map<string, typeof paidTxs>();
  for (const tx of paidTxs) {
    const list = txsByBuilder.get(tx.builderId) || [];
    list.push(tx);
    txsByBuilder.set(tx.builderId, list);
  }

  const headers = [
    "ID Builder",
    "Nama Builder",
    "Email",
    "Status",
    "Jumlah Aplikasi",
    "Bank / E-Wallet",
    "Nomor Rekening",
    "Nama Pemilik Rekening",
    "Total GMV (IDR)",
    "Total Net Hak Builder (IDR)",
    "Saldo Belum Dicairkan (IDR)",
    "Tanggal Bergabung",
  ];

  let csv = "\uFEFF" + toCsvRow(headers);

  for (const b of allBuilders) {
    const bTxs = txsByBuilder.get(b.id) || [];
    const gmv = bTxs.reduce((sum, tx) => sum + tx.grossAmount, 0);
    const net = bTxs.reduce((sum, tx) => sum + tx.netAmount, 0);
    const pending = bTxs
      .filter((tx) => tx.disbursementStatus === "PENDING")
      .reduce((sum, tx) => sum + tx.netAmount, 0);

    const bank = b.disbursementAccount;

    csv += toCsvRow([
      b.id,
      b.name,
      b.email,
      b.isSuspended ? "SUSPENDED" : "ACTIVE",
      appsCountByBuilder.get(b.id) || 0,
      bank?.bankCode || bank?.eWalletType || "Belum Diatur",
      bank?.accountNumber || bank?.phoneNumber || "-",
      bank?.accountHolderName || "-",
      gmv,
      net,
      pending,
      b.createdAt.toISOString(),
    ]);
  }

  const dateStr = new Date().toISOString().split("T")[0];
  set.headers["Content-Type"] = "text/csv; charset=utf-8";
  set.headers["Content-Disposition"] = `attachment; filename="tertaut-builders-${dateStr}.csv"`;

  return csv;
}

/**
 * Ekspor Direktori Seluruh Software/Aplikasi ke format CSV (RFC 4180 + UTF-8 BOM)
 */
export async function handleExportApps({ set }: any) {
  const allApps = await db.query.apps.findMany({
    orderBy: [desc(apps.createdAt)],
  });

  const builderIds = [...new Set(allApps.map((a) => a.builderId))];
  const builderRows = builderIds.length
    ? await db.query.builders.findMany({
        where: inArray(builders.id, builderIds),
      })
    : [];

  const builderEmailMap = new Map(builderRows.map((b) => [b.id, b.email]));
  const builderNameMap = new Map(builderRows.map((b) => [b.id, b.name]));

  const headers = [
    "ID Software",
    "Nama Software",
    "Slug",
    "Builder",
    "Email Builder",
    "Mode",
    "Status",
    "Tipe Harga",
    "Harga (IDR)",
    "Metode Delivery",
    "Waktu Dibuat",
  ];

  let csv = "\uFEFF" + toCsvRow(headers);

  for (const a of allApps) {
    const delivery = a.deliveryConfig?.licenseKey?.enabled
      ? "License Key"
      : a.deliveryConfig?.fileDownload?.enabled
        ? "File Download"
        : a.deliveryConfig?.apiAccess?.enabled
          ? "API Access"
          : "Other";

    csv += toCsvRow([
      a.id,
      a.name,
      a.slug,
      builderNameMap.get(a.builderId) || "-",
      builderEmailMap.get(a.builderId) || "-",
      a.mode,
      a.isSuspended ? "SUSPENDED" : "ACTIVE",
      a.pricingType,
      a.targetPrice,
      delivery,
      a.createdAt.toISOString(),
    ]);
  }

  const dateStr = new Date().toISOString().split("T")[0];
  set.headers["Content-Type"] = "text/csv; charset=utf-8";
  set.headers["Content-Disposition"] = `attachment; filename="tertaut-apps-${dateStr}.csv"`;

  return csv;
}

/**
 * Ekspor Daftar Seluruh Lisensi ke format CSV (RFC 4180 + UTF-8 BOM)
 */
export async function handleExportLicenses({ set }: any) {
  const allLicenses = await db.query.licenses.findMany({
    orderBy: [desc(licenses.createdAt)],
    limit: 10000,
  });

  const appIds = [...new Set(allLicenses.map((l) => l.appId))];
  const appRows = appIds.length
    ? await db.query.apps.findMany({
        where: inArray(apps.id, appIds),
      })
    : [];

  const appNameMap = new Map(appRows.map((a) => [a.id, a.name]));

  const headers = [
    "ID Lisensi",
    "License Key",
    "Software",
    "Email Pelanggan",
    "Status",
    "Max Seats",
    "Platform",
    "Hardware ID",
    "Offline Grace Token",
    "Kedaluwarsa",
    "Waktu Dibuat",
  ];

  let csv = "\uFEFF" + toCsvRow(headers);

  for (const l of allLicenses) {
    csv += toCsvRow([
      l.id,
      l.licenseKey,
      appNameMap.get(l.appId) || l.appId,
      l.customerEmail,
      l.status,
      l.maxSeats,
      l.platform || "general",
      l.hardwareId || "-",
      l.offlineJwtGraceToken ? "Ada (30 Hari)" : "Tidak Ada",
      l.expiresAt ? l.expiresAt.toISOString() : "Seumur Hidup (Lifetime)",
      l.createdAt.toISOString(),
    ]);
  }

  const dateStr = new Date().toISOString().split("T")[0];
  set.headers["Content-Type"] = "text/csv; charset=utf-8";
  set.headers["Content-Disposition"] = `attachment; filename="tertaut-licenses-${dateStr}.csv"`;

  return csv;
}
