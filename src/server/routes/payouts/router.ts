import { submitPayout, PayoutConflictError } from "../../services/payments/payouts";
import { Elysia, t } from "elysia";
import { db } from "../../db";
import { transactions, builders, projects, platformSettings } from "../../db/schema";
import { eq, and, inArray, ne } from "drizzle-orm";
import { resolveDisbursementAccount } from "../../services/payments/payoutAccount";
import { getActiveGateway } from "../../services/payments/gateways";
import { config } from "../../config";
import { authenticate, isAdminUser } from "../../middleware/auth";

/** FR-4.2 Default minimum disbursement threshold Rp 50.000 */
const DEFAULT_MIN_THRESHOLD = 50000;

async function resolveMinPayoutThreshold(): Promise<number> {
  try {
    const row = await db.query.platformSettings.findFirst({
      where: eq(platformSettings.key, "min_payout_threshold"),
    });
    const parsed = Number(row?.value);
    if (Number.isFinite(parsed) && parsed >= 10000) {
      return Math.round(parsed);
    }
  } catch {}
  return DEFAULT_MIN_THRESHOLD;
}

const formatIdr = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(value);

export const payoutsRoutes = new Elysia({ prefix: "/payouts" })
  .onBeforeHandle(async ({ request: { headers }, status }) => {
    const res = await authenticate(headers);
    if ("status" in res) return status(res.status, { error: res.error });
  })
  /**
   * PRD 7.1 C: Trigger Builder Payout (Disbursement)
   */
  .post(
    "/trigger",
    async ({ body, set, request }) => {
      const { amount, builderId, mode } = body || {};

      // Environment Sandbox tidak boleh mencairkan dana nyata.
      if (mode === "sandbox") {
        set.status = 400;
        return {
          success: false,
          error:
            "Pencairan tidak tersedia di environment Sandbox. Transaksi sandbox bersifat simulasi.",
        };
      }

      // Jangan pernah menebak builder: saldo harus selalu milik pemanggil.
      // Admin boleh menyebut builder mana pun; non-admin hanya builder miliknya.
      const authResult = await authenticate(request.headers);
      if ("status" in authResult) {
        set.status = authResult.status;
        return { success: false, error: authResult.error };
      }
      const isAdmin = isAdminUser(authResult.user);

      let builder = builderId
        ? await db.query.builders.findFirst({ where: eq(builders.id, builderId) })
        : await db.query.builders.findFirst({ where: eq(builders.userId, authResult.user.id) });

      if (builder && !isAdmin && builder.userId !== authResult.user.id) {
        set.status = 403;
        return {
          success: false,
          error: "Anda hanya dapat mencairkan saldo builder milik sendiri.",
        };
      }

      if (!builder) {
        set.status = builderId ? 404 : 400;
        return {
          success: false,
          error: builderId
            ? "Builder account not found"
            : "builderId wajib diisi: tidak ada profil builder yang tertaut ke akun ini.",
        };
      }

      // Hanya transaksi dari aplikasi mode LIVE yang boleh dicairkan.
      // Transaksi sandbox adalah simulasi dan tidak pernah dikirim ke Xendit.
      const liveAppRows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.mode, "live"));
      const liveAppIds = liveAppRows.map((a) => a.id);

      // Ambil HANYA transaksi milik builder ini yang sudah lunas (PAID)
      // dan belum dicairkan (PENDING), dibatasi ke aplikasi live.
      const eligibleTxs = liveAppIds.length
        ? await db.query.transactions.findMany({
            where: and(
              eq(transactions.builderId, builder.id),
              eq(transactions.paymentStatus, "PAID"),
              inArray(transactions.refundStatus, ["NONE", "FAILED"]),
              eq(transactions.mode, "live"),
              ne(transactions.paymentProvider, "sandbox"),
              eq(transactions.disbursementStatus, "PENDING"),
              inArray(transactions.appId, liveAppIds)
            ),
            orderBy: (tx, { asc }) => [asc(tx.createdAt)],
          })
        : [];

      const totalPendingNet = eligibleTxs.reduce((sum, tx) => sum + tx.netAmount, 0);

      if (totalPendingNet <= 0) {
        set.status = 400;
        return {
          success: false,
          error: "Tidak ada saldo bersih yang siap dicairkan.",
          currentPendingNet: 0,
        };
      }

      // Validasi ambang minimum terhadap nilai yang benar-benar akan dicairkan.
      const minThreshold = await resolveMinPayoutThreshold();
      const requestedAmount = amount ?? totalPendingNet;
      if (requestedAmount < minThreshold) {
        set.status = 400;
        return {
          success: false,
          error: `Saldo belum mencapai batas minimum pencairan (${formatIdr(minThreshold)}). Jumlah yang diminta: ${formatIdr(requestedAmount)}`,
          currentPendingNet: totalPendingNet,
        };
      }

      // Pilih transaksi secara FIFO. Satu transaksi tidak pernah dipotong sebagian,
      // sehingga total disbursement selalu sama dengan jumlah net transaksi terpilih.
      const cap = Math.min(requestedAmount, totalPendingNet);
      const selectedTxs: typeof eligibleTxs = [];
      let payoutTotal = 0;
      for (const tx of eligibleTxs) {
        if (payoutTotal + tx.netAmount > cap) break;
        selectedTxs.push(tx);
        payoutTotal += tx.netAmount;
      }

      if (selectedTxs.length === 0) {
        set.status = 400;
        return {
          success: false,
          error: `Jumlah ${formatIdr(cap)} lebih kecil dari transaksi tertua yang belum dicairkan (${formatIdr(eligibleTxs[0].netAmount)}).`,
          currentPendingNet: totalPendingNet,
        };
      }

      const recipient = resolveDisbursementAccount(builder);
      // Production TANPA rekening tersimpan → tolak pencairan (jangan pakai data palsu)
      if (!recipient) {
        set.status = 400;
        return {
          success: false,
          error:
            "Builder belum menyimpan rekening penerima disbursement. Lengkapi profil bank/e-wallet terlebih dahulu.",
        };
      }

      const gateway = await getActiveGateway();
      if (gateway.id === "sandbox") {
        set.status = 400;
        return { success: false, error: "Gateway sandbox tidak dapat mencairkan saldo live" };
      }
      try {
        const result = await submitPayout({
          transactionIds: selectedTxs.map((t) => t.id),
          builderId: builder.id,
          gateway,
          recipient,
          description: `Pencairan Saldo Bersih Builder tertaut.com (${gateway.displayName})`,
        });
        set.status = result.status === "FAILED" ? 502 : result.status === "COMPLETED" ? 200 : 202;
        return {
          success: result.status !== "FAILED",
          message:
            result.status === "COMPLETED"
              ? "Disbursement completed successfully"
              : "Pencairan menunggu konfirmasi provider; saldo tetap ditahan untuk rekonsiliasi",
          data: {
            builderId: builder.id,
            amount: result.amount,
            bankCode: recipient.bankCode,
            recipientName: recipient.accountHolderName,
            processedTransactions: selectedTxs.map((t) => t.id),
            currentPendingNet: totalPendingNet,
            disbursementId: result.id,
            disbursementExternalId: result.externalId,
            status: result.status,
          },
        };
      } catch (error) {
        set.status = error instanceof PayoutConflictError ? 409 : 502;
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    {
      body: t.Optional(
        t.Object({
          amount: t.Optional(t.Number({ minimum: 10000 })),
          builderId: t.Optional(t.String({ format: "uuid" })),
          mode: t.Optional(t.Union([t.Literal("sandbox"), t.Literal("live")])),
        })
      ),
      detail: {
        tags: ["MoR Checkout"],
        summary: "Trigger Builder Payout",
        description:
          "Disburses one builder's accumulated net earnings directly to their bank or e-wallet account via Xendit Payout API",
      },
    }
  )
  /**
   * Ambil data rekening pencairan builder yang login
   */
  .get(
    "/account",
    async ({ request, set }) => {
      const authResult = await authenticate(request.headers);
      if ("status" in authResult) {
        set.status = authResult.status;
        return { success: false, error: authResult.error };
      }

      const builder =
        (await db.query.builders.findFirst({
          where: eq(builders.userId, authResult.user.id),
        })) ||
        (await db.query.builders.findFirst({
          where: eq(builders.email, authResult.user.email),
        }));

      if (!builder) {
        set.status = 404;
        return { success: false, error: "Profil builder belum terdaftar." };
      }

      return {
        success: true,
        disbursementAccount: builder.disbursementAccount || null,
        builderName: builder.name,
      };
    },
    {
      detail: {
        tags: ["MoR Checkout"],
        summary: "Get Builder Disbursement Account",
      },
    }
  )
  /**
   * Ringkasan saldo & riwayat batch pencairan builder (seluruh transaksi tanpa batas pagination 200)
   */
  .get(
    "/summary",
    async ({ query, request, set }) => {
      const authResult = await authenticate(request.headers);
      if ("status" in authResult) {
        set.status = authResult.status;
        return { success: false, error: authResult.error };
      }

      const mode = query?.mode === "sandbox" ? "sandbox" : "live";
      const minThreshold = await resolveMinPayoutThreshold();

      const builder =
        (await db.query.builders.findFirst({
          where: eq(builders.userId, authResult.user.id),
        })) ||
        (await db.query.builders.findFirst({
          where: eq(builders.email, authResult.user.email),
        }));

      if (!builder) {
        return {
          success: true,
          minThreshold,
          kpis: {
            availableBalance: 0,
            availableCount: 0,
            processingBalance: 0,
            totalPaidOut: 0,
            totalFeeMoR: 0,
          },
          disbursementGroups: [],
        };
      }

      const [paidTxs, liveApps] = await Promise.all([
        db
          .select({
            id: transactions.id,
            appId: transactions.appId,
            netAmount: transactions.netAmount,
            platformFee: transactions.platformFee,
            paymentProvider: transactions.paymentProvider,
            refundStatus: transactions.refundStatus,
            disbursementStatus: transactions.disbursementStatus,
            disbursementId: transactions.disbursementId,
            disbursementExternalId: transactions.disbursementExternalId,
            paidAt: transactions.paidAt,
            createdAt: transactions.createdAt,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.builderId, builder.id),
              eq(transactions.paymentStatus, "PAID"),
              eq(transactions.mode, mode)
            )
          ),
        mode === "live"
          ? db.select({ id: projects.id }).from(projects).where(eq(projects.mode, "live"))
          : Promise.resolve([]),
      ]);

      const liveAppIdSet = new Set(liveApps.map((a) => a.id));

      let availableBalance = 0;
      let availableCount = 0;
      let processingBalance = 0;
      let totalPaidOut = 0;
      let totalFeeMoR = 0;

      const groupMap = new Map<
        string,
        {
          disbursementId: string;
          status: "COMPLETED" | "PROCESSING";
          totalNet: number;
          latestDate: string | null;
        }
      >();

      for (const tx of paidTxs) {
        totalFeeMoR += tx.platformFee || 0;
        const refundClear = tx.refundStatus === "NONE" || tx.refundStatus === "FAILED";
        const isLiveEligible =
          mode === "sandbox" || (tx.paymentProvider !== "sandbox" && liveAppIdSet.has(tx.appId));

        if (tx.disbursementStatus === "PENDING" && refundClear && isLiveEligible) {
          availableBalance += tx.netAmount || 0;
          availableCount += 1;
        } else if (tx.disbursementStatus === "PROCESSING") {
          processingBalance += tx.netAmount || 0;
        } else if (tx.disbursementStatus === "COMPLETED") {
          totalPaidOut += tx.netAmount || 0;
        }

        const batchRef = tx.disbursementId || tx.disbursementExternalId;
        if (
          (tx.disbursementStatus === "COMPLETED" || tx.disbursementStatus === "PROCESSING") &&
          batchRef
        ) {
          if (!groupMap.has(batchRef)) {
            groupMap.set(batchRef, {
              disbursementId: batchRef,
              status: tx.disbursementStatus,
              totalNet: 0,
              latestDate: null,
            });
          }
          const grp = groupMap.get(batchRef)!;
          grp.totalNet += tx.netAmount || 0;
          const d = (tx.paidAt || tx.createdAt)?.toISOString() || null;
          if (d && (!grp.latestDate || d > grp.latestDate)) {
            grp.latestDate = d;
          }
        }
      }

      const disbursementGroups = [...groupMap.values()].sort((a, b) => {
        if (!a.latestDate) return 1;
        if (!b.latestDate) return -1;
        return b.latestDate.localeCompare(a.latestDate);
      });

      return {
        success: true,
        minThreshold,
        kpis: {
          availableBalance,
          availableCount,
          processingBalance,
          totalPaidOut,
          totalFeeMoR,
        },
        disbursementGroups,
      };
    },
    {
      query: t.Object({
        mode: t.Optional(t.Union([t.Literal("sandbox"), t.Literal("live")])),
      }),
      detail: {
        tags: ["MoR Checkout"],
        summary: "Get Builder Balance & Disbursement Summary",
      },
    }
  )
  /**
   * Simpan / Perbarui data rekening pencairan builder
   */
  .post(
    "/account",
    async ({ body, request, set }) => {
      const authResult = await authenticate(request.headers);
      if ("status" in authResult) {
        set.status = authResult.status;
        return { success: false, error: authResult.error };
      }

      let builder =
        (await db.query.builders.findFirst({
          where: eq(builders.userId, authResult.user.id),
        })) ||
        (await db.query.builders.findFirst({
          where: eq(builders.email, authResult.user.email),
        }));

      if (!builder) {
        set.status = 404;
        return { success: false, error: "Profil builder belum terdaftar." };
      }

      const { bankCode, accountNumber, accountHolderName, eWalletType, phoneNumber } = body;

      const SUPPORTED_PAYOUT_CHANNELS = new Set([
        "BCA",
        "BNI",
        "BRI",
        "MANDIRI",
        "PERMATA",
        "BSI",
        "CIMB",
        "BNC",
        "MEGA",
        "BJB",
        "BTPN",
        "BTPN_SYARIAH",
        "MANDIRI_SYR",
        "MANDIRI_TASPEN",
        "SAHABAT_SAMPOERNA",
        "DANA",
        "GOPAY",
        "OVO",
        "LINKAJA",
        "SHOPEEPAY",
      ]);
      const EWALLET_CHANNELS = new Set(["DANA", "GOPAY", "OVO", "LINKAJA", "SHOPEEPAY"]);

      const normalizedCode = bankCode ? bankCode.trim().toUpperCase().replace(/^ID_/, "") : "";
      if (normalizedCode && !SUPPORTED_PAYOUT_CHANNELS.has(normalizedCode)) {
        set.status = 400;
        return {
          success: false,
          error: `Kanal pencairan "${bankCode}" belum didukung.`,
        };
      }

      let normalizedAccount = accountNumber ? accountNumber.trim() : undefined;
      if (normalizedCode && EWALLET_CHANNELS.has(normalizedCode)) {
        const rawDigits = (normalizedAccount || phoneNumber || "").replace(/[^0-9]/g, "");
        const formatted = rawDigits.startsWith("08")
          ? `62${rawDigits.slice(1)}`
          : rawDigits.startsWith("8")
            ? `62${rawDigits}`
            : rawDigits;
        if (!/^628\d{7,12}$/.test(formatted)) {
          set.status = 400;
          return {
            success: false,
            error: `Pencairan ke ${normalizedCode} wajib menggunakan nomor HP valid (contoh: 6281234567890 atau 081234567890).`,
          };
        }
        normalizedAccount = formatted;
      }

      const updatedAccount = {
        bankCode: normalizedCode || undefined,
        accountNumber: normalizedAccount,
        accountHolderName: accountHolderName?.trim() || undefined,
        eWalletType:
          eWalletType || (EWALLET_CHANNELS.has(normalizedCode) ? normalizedCode : undefined),
        phoneNumber:
          phoneNumber || (EWALLET_CHANNELS.has(normalizedCode) ? normalizedAccount : undefined),
      };

      await db
        .update(builders)
        .set({
          disbursementAccount: updatedAccount,
          updatedAt: new Date(),
        })
        .where(eq(builders.id, builder.id));

      return {
        success: true,
        message: "Rekening pencairan berhasil disimpan.",
        disbursementAccount: updatedAccount,
      };
    },
    {
      body: t.Object({
        bankCode: t.Optional(t.String()),
        accountNumber: t.Optional(t.String()),
        accountHolderName: t.Optional(t.String()),
        eWalletType: t.Optional(t.String()),
        phoneNumber: t.Optional(t.String()),
      }),
      detail: {
        tags: ["MoR Checkout"],
        summary: "Update Builder Disbursement Account",
      },
    }
  );
