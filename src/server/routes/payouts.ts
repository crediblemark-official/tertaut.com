import { Elysia, t } from "elysia";
import { db } from "../db";
import { transactions, builders } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { XenditService } from "../services/xendit";

/** FR-4.2 Minimum disbursement threshold Rp 50.000 */
const MIN_THRESHOLD = 50000;

const formatIdr = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(value);

export const payoutsRoutes = new Elysia({ prefix: "/payouts" })
  /**
   * PRD 7.1 C: Trigger Builder Payout (Disbursement)
   */
  .post(
    "/trigger",
    async ({ body, set }) => {
      const { amount, builderId } = body || {};

      // Dapatkan profil builder. Tanpa sesi terautentikasi, pemanggil wajib
      // menyebut builder mana yang dicairkan supaya saldo tidak pernah tercampur.
      const builder = builderId
        ? await db.query.builders.findFirst({ where: eq(builders.id, builderId) })
        : await db.query.builders.findFirst();

      if (!builder) {
        set.status = 404;
        return { success: false, error: "Builder account not found" };
      }

      // Ambil HANYA transaksi milik builder ini yang sudah lunas (PAID)
      // dan belum dicairkan (PENDING).
      const eligibleTxs = await db.query.transactions.findMany({
        where: and(
          eq(transactions.builderId, builder.id),
          eq(transactions.paymentStatus, "PAID"),
          eq(transactions.disbursementStatus, "PENDING")
        ),
        orderBy: (tx, { asc }) => [asc(tx.createdAt)],
      });

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

      const recipient = XenditService.resolveDisbursementAccount(builder);
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
        const disbResult = await XenditService.createDisbursement({
          externalId,
          amount: disburseAmount,
          ...recipient,
          description: `Pencairan Saldo Bersih Builder tertaut.com`,
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
            disbursementId: disbResult.id,
            updatedAt: new Date(),
          })
          .where(inArray(transactions.id, lockedIds));

        if (finalStatus === "FAILED") {
          set.status = 502;
          return {
            success: false,
            error:
              "Xendit menolak permintaan pencairan (status FAILED). Saldo tidak terkirim; transaksi perlu di-set ulang ke PENDING untuk dicoba lagi.",
            data: { ...responseData, disbursementId: disbResult.id, status: finalStatus },
          };
        }

        if (finalStatus === "PROCESSING") {
          return {
            success: true,
            message:
              "Pencairan sedang diproses oleh Xendit dan belum final. Status akan diperbarui lewat webhook disbursement.",
            data: { ...responseData, disbursementId: disbResult.id, status: finalStatus },
          };
        }

        return {
          success: true,
          message: "Disbursement completed successfully",
          data: { ...responseData, disbursementId: disbResult.id, status: finalStatus },
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
          error: err.message || "Gagal memproses payout Xendit",
        };
      }
    },
    {
      body: t.Optional(
        t.Object({
          amount: t.Optional(t.Number({ minimum: 10000 })),
          builderId: t.Optional(t.String({ format: "uuid" })),
        })
      ),
      detail: {
        tags: ["MoR Checkout"],
        summary: "Trigger Builder Payout",
        description:
          "Disburses one builder's accumulated net earnings directly to their bank or e-wallet account via Xendit Payout API",
      },
    }
  );
