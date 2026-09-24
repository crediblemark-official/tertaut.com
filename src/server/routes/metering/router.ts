import { Elysia, t } from "elysia";
import { db } from "../../db";
import { licenses, apps, creditLedger } from "../../db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { CreditService } from "../../services/credits";
import { resolveCurrentBuilder } from "../apps/builder";
import { authorizeLicense } from "../licensing/credits";

/**
 * BUG A5: endpoint /metering/events sebelumnya mendebit kredit hanya berbekal
 * licenseKey. Lisensi adalah identifier semi-rahasia (tertanam di aplikasi
 * client), sehingga pihak ketiga yang mencurinya bisa menguras saldo kredit.
 * Wajib bukti kepemilikan: (a) perangkat teraktivasi (hwid) ATAU
 * (b) API key publik aplikasi pemilik lisensi (x-api-key / Authorization Bearer).
 */
async function authorizeMeteringEvent(
  lic: any,
  app: any,
  hwid: string | undefined,
  headers: Headers
): Promise<{ ok: true } | { ok: false; status: number; reason: string; message: string }> {
  // (a) Jalur perangkat: hwid wajib milik aktivasi yang masih berlaku.
  if (hwid) {
    const auth = await authorizeLicense(lic.licenseKey, hwid, true);
    if (auth.ok) return { ok: true };
    return { ok: false, status: auth.status, reason: auth.reason, message: auth.message };
  }

  // (b) Jalur API key aplikasi (dikirim SDK via header x-api-key).
  const bearer = headers.get("authorization") || "";
  const bearerKey = bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : "";
  const apiKeyHeader = headers.get("x-api-key") || "";
  const presentedKey = apiKeyHeader || bearerKey;
  if (presentedKey && app?.apiKey && presentedKey === app.apiKey) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    reason: "METERING_UNAUTHORIZED",
    message:
      "Debit metering wajib disertai hwid perangkat teraktivasi atau X-Api-Key aplikasi pemilik lisensi.",
  };
}

export const meteringRoutes = new Elysia({ prefix: "/metering" })
  /**
   * Ingest usage / consumption event for a license (P3)
   * Terhubung langsung dengan CreditService.debitAtomic dan app.meteringConfig
   */
  .post(
    "/events",
    async ({ body, set, request }) => {
      const { licenseKey, eventName, units = 1, idempotencyKey, metadata, hwid } = body;

      if (!licenseKey || typeof licenseKey !== "string") {
        set.status = 400;
        return { success: false, error: "licenseKey wajib disertakan" };
      }

      if (!eventName || typeof eventName !== "string") {
        set.status = 400;
        return { success: false, error: "eventName wajib disertakan" };
      }

      const parsedUnits = Math.max(1, Math.floor(Number(units) || 1));

      // Cari lisensi aktif
      const lic = await db.query.licenses.findFirst({
        where: eq(licenses.licenseKey, licenseKey.trim()),
      });

      if (!lic) {
        set.status = 404;
        return { success: false, error: "Lisensi tidak ditemukan" };
      }

      if (lic.status !== "ACTIVE") {
        set.status = 403;
        return { success: false, error: `Lisensi tidak aktif (status: ${lic.status})` };
      }

      // Ambil konfigurasi aplikasi
      const app = await db.query.apps.findFirst({
        where: eq(apps.id, lic.appId),
      });

      if (!app) {
        set.status = 404;
        return { success: false, error: "Aplikasi lisensi tidak ditemukan" };
      }

      const meteringConfig = app.meteringConfig as any;
      if (!meteringConfig || !meteringConfig.enabled) {
        set.status = 400;
        return {
          success: false,
          error: "Metered billing belum diaktifkan untuk aplikasi ini di Dashboard",
        };
      }

      // BUG A5: otorisasi wajib sebelum debit (lihat authorizeMeteringEvent di atas).
      const auth = await authorizeMeteringEvent(lic, app, hwid, request.headers);
      if (!auth.ok) {
        set.status = auth.status;
        return { success: false, error: auth.message, reason: auth.reason };
      }

      // Hitung kredit yang dikonsumsi per unit
      const unitMultiplier = Math.max(1, Math.round(Number(meteringConfig.unitPrice) || 1));
      const totalCreditsToDebit = parsedUnits * unitMultiplier;

      // Eksekusi debit atomik via CreditService
      const debitRes = await CreditService.debit(
        {
          licenseId: lic.id,
          appId: app.id,
          customerEmail: lic.customerEmail,
        },
        totalCreditsToDebit,
        {
          reference: idempotencyKey || null,
          description: `Usage [${eventName}]: ${parsedUnits} ${meteringConfig.unitLabel || "unit"}`,
          metadata: metadata || null,
        }
      );

      if (!debitRes.ok) {
        if (debitRes.reason === "INSUFFICIENT_CREDITS") {
          set.status = 402; // Payment Required
          return {
            success: false,
            error: "Saldo kredit lisensi tidak mencukupi untuk konsumsi ini",
            requiredCredits: totalCreditsToDebit,
            currentBalance: debitRes.balance,
          };
        }
        set.status = 400;
        return { success: false, error: "Gagal memproses konsumsi metering" };
      }

      return {
        success: true,
        message: `Konsumsi ${parsedUnits} ${meteringConfig.unitLabel || "unit"} berhasil dicatat`,
        eventName,
        unitsConsumed: parsedUnits,
        creditsDebited: totalCreditsToDebit,
        remainingBalance: debitRes.balance,
      };
    },
    {
      body: t.Object({
        licenseKey: t.String(),
        eventName: t.String(),
        units: t.Optional(t.Number()),
        idempotencyKey: t.Optional(t.String()),
        metadata: t.Optional(t.Any()),
        hwid: t.Optional(t.String()),
      }),
    }
  )

  /**
   * Riwayat pemakaian metering per lisensi
   */
  .get("/usage/:licenseKey", async ({ params: { licenseKey }, set }) => {
    const lic = await db.query.licenses.findFirst({
      where: eq(licenses.licenseKey, licenseKey.trim()),
    });

    if (!lic) {
      set.status = 404;
      return { success: false, error: "Lisensi tidak ditemukan" };
    }

    const balance = await CreditService.getBalance(lic.id);
    const history = await db.query.creditLedger.findMany({
      where: eq(creditLedger.licenseId, lic.id),
      orderBy: [desc(creditLedger.createdAt)],
      limit: 50,
    });

    return {
      success: true,
      licenseKey: lic.licenseKey,
      status: lic.status,
      balance,
      currentBalance: balance,
      history,
      events: history.map((h) => ({
        id: h.id,
        type: h.type,
        delta: h.delta,
        balanceAfter: h.balanceAfter,
        description: h.description,
        reference: h.reference,
        createdAt: h.createdAt,
      })),
    };
  })

  /**
   * Statistik ringkasan penggunaan metering builder
   */
  .get("/stats", async ({ request: { headers }, set }) => {
    const { builder, isAdmin } = await resolveCurrentBuilder(headers);
    if (!isAdmin && !builder) {
      set.status = 401;
      return { success: false, error: "Unauthorized" };
    }

    const builderApps = await db
      .select({ id: apps.id, name: apps.name })
      .from(apps)
      .where(!isAdmin && builder ? eq(apps.builderId, builder.id) : undefined);

    const appIds = builderApps.map((a) => a.id);
    if (appIds.length === 0) {
      return {
        success: true,
        totalEvents: 0,
        totalCreditsConsumed: 0,
        appsCount: 0,
      };
    }

    const [agg] = await db
      .select({
        totalEvents: sql<number>`count(*)::int`,
        totalCreditsConsumed: sql<number>`coalesce(sum(case when ${creditLedger.delta} < 0 then abs(${creditLedger.delta}) else 0 end), 0)::int`,
      })
      .from(creditLedger)
      .where(and(inArray(creditLedger.appId, appIds), eq(creditLedger.type, "DEBIT")));

    return {
      success: true,
      totalEvents: agg?.totalEvents || 0,
      totalCreditsConsumed: agg?.totalCreditsConsumed || 0,
      appsCount: appIds.length,
    };
  });
