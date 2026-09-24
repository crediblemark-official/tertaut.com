import { Elysia, t } from "elysia";
import { db } from "../../db";
import { transactions, builders, apps } from "../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { DanaService } from "../../services/dana";
import { getActiveGateway } from "../../services/gateways";
import { config } from "../../config";
import { authenticate, isAdminUser } from "../../middleware/auth";

/** FR-4.2 Minimum disbursement threshold Rp 50.000 */
const MIN_THRESHOLD = 50000;

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
      const liveAppRows = await db.select({ id: apps.id }).from(apps).where(eq(apps.mode, "live"));
      const liveAppIds = liveAppRows.map((a) => a.id);

      // Ambil HANYA transaksi milik builder ini yang sudah lunas (PAID)
      // dan belum dicairkan (PENDING), dibatasi ke aplikasi live.
      const eligibleTxs = liveAppIds.length
        ? await db.query.transactions.findMany({
            where: and(
              eq(transactions.builderId, builder.id),
              eq(transactions.paymentStatus, "PAID"),
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
      const requestedAmount = amount ?? totalPendingNet;
      if (requestedAmount < MIN_THRESHOLD) {
        set.status = 400;
        return {
          success: false,
          error: `Saldo belum mencapai batas minimum pencairan (${formatIdr(MIN_THRESHOLD)}). Jumlah yang diminta: ${formatIdr(requestedAmount)}`,
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

      const disburseAmount = payoutTotal;
      const lockedIds = selectedTxs.map((tx) => tx.id);

      // Atomic lock: conditional UPDATE mencegah dua request mencairkan transaksi yang sama.
      const locked = await db
        .update(transactions)
        .set({ disbursementStatus: "PROCESSING", updatedAt: new Date() })
        .where(
          and(
            inArray(transactions.id, lockedIds),
            eq(transactions.builderId, builder.id),
            eq(transactions.paymentStatus, "PAID"),
            eq(transactions.disbursementStatus, "PENDING")
          )
        )
        .returning({ id: transactions.id });

      if (locked.length !== lockedIds.length) {
        // Kembalikan lock yang sempat kita ambil agar builder bisa mencoba lagi.
        const acquiredIds = locked.map((row) => row.id);
        if (acquiredIds.length > 0) {
          await db
            .update(transactions)
            .set({ disbursementStatus: "PENDING", updatedAt: new Date() })
            .where(
              and(
                inArray(transactions.id, acquiredIds),
                eq(transactions.disbursementStatus, "PROCESSING")
              )
            );
        }
        set.status = 409;
        return {
          success: false,
          error: "Pencairan transaksi ini sedang diproses oleh permintaan lain. Coba lagi.",
        };
      }

      const recipient = DanaService.resolveDisbursementAccount(builder);
      // Production TANPA rekening tersimpan → tolak pencairan (jangan pakai data palsu)
      if (!recipient) {
        set.status = 400;
        return {
          success: false,
          error:
            "Builder belum menyimpan rekening penerima disbursement. Lengkapi profil bank/e-wallet terlebih dahulu.",
        };
      }

      const externalId = `disb_payout_${builder.id}_${Date.now()}`;
      const responseData = {
        builderId: builder.id,
        amount: disburseAmount,
        bankCode: recipient.bankCode,
        recipientName: recipient.accountHolderName,
        processedTransactions: lockedIds,
        currentPendingNet: totalPendingNet,
      };

      try {
        const gateway = await getActiveGateway();
        const gatewayLabel = gateway.displayName || (gateway.id === "xendit" ? "Xendit" : "DANA");
        const disbResult = await gateway.createDisbursement({
          externalId,
          amount: disburseAmount,
          accountNumber: recipient.accountNumber,
          bankCode: recipient.bankCode,
          accountHolderName: recipient.accountHolderName,
          description: `Pencairan Saldo Bersih Builder tertaut.com (${gatewayLabel})`,
        });

        // Hanya tandai COMPLETED kalau gateway benar-benar menyelesaikannya.
        const finalStatus =
          disbResult.status === "COMPLETED"
            ? "COMPLETED"
            : disbResult.status === "FAILED"
              ? "FAILED"
              : "PROCESSING";

        await db
          .update(transactions)
          .set({
            disbursementStatus: finalStatus,
            disbursementId: disbResult.externalId || (disbResult as any).id,
            updatedAt: new Date(),
          })
          .where(inArray(transactions.id, lockedIds));

        if (finalStatus === "FAILED") {
          set.status = 502;
          return {
            success: false,
            error: `${gatewayLabel} menolak permintaan pencairan (status FAILED). Saldo tidak terkirim; transaksi perlu di-set ulang ke PENDING untuk dicoba lagi.`,
            data: {
              ...responseData,
              disbursementId: disbResult.externalId || (disbResult as any).id,
              status: finalStatus,
            },
          };
        }

        if (finalStatus === "PROCESSING") {
          return {
            success: true,
            message: `Pencairan sedang diproses oleh ${gatewayLabel} dan belum final. Status akan diperbarui lewat webhook disbursement.`,
            data: {
              ...responseData,
              disbursementId: disbResult.externalId || (disbResult as any).id,
              status: finalStatus,
            },
          };
        }

        return {
          success: true,
          message: "Disbursement completed successfully",
          data: {
            ...responseData,
            disbursementId: disbResult.externalId || (disbResult as any).id,
            status: finalStatus,
          },
        };
      } catch (err: any) {
        // Bebaskan lock supaya saldo tidak tertahan permanen saat gateway gagal.
        await db
          .update(transactions)
          .set({ disbursementStatus: "PENDING", updatedAt: new Date() })
          .where(
            and(
              inArray(transactions.id, lockedIds),
              eq(transactions.disbursementStatus, "PROCESSING")
            )
          );

        set.status = 502;
        return {
          success: false,
          error: err.message || "Gagal memproses payout",
        };
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

      const updatedAccount = {
        bankCode: bankCode || undefined,
        accountNumber: accountNumber || undefined,
        accountHolderName: accountHolderName || undefined,
        eWalletType: eWalletType || undefined,
        phoneNumber: phoneNumber || undefined,
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
