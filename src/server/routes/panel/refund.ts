import { db } from "../../db";
import { licenses } from "../../db/schema";
import { eq } from "drizzle-orm";
import { requestRefund, RefundRequestError } from "../../services/payments/refunds";

export async function handleRefundTransaction({ params, body, set }: any) {
  try {
    const op = await requestRefund(params.txId, body?.reason || "Permintaan refund oleh admin");
    const completed = op.status === "COMPLETED";
    const license = completed
      ? await db.query.licenses.findFirst({ where: eq(licenses.transactionId, params.txId) })
      : null;
    set.status = completed ? 200 : op.status === "FAILED" ? 502 : 202;
    return {
      success: op.status !== "FAILED",
      message: completed
        ? "Provider mengonfirmasi refund selesai. Lisensi terkait telah dicabut."
        : op.status === "FAILED"
          ? "Provider menolak refund; dana belum dikembalikan."
          : "Refund diajukan; menunggu konfirmasi provider. Dana belum dinyatakan kembali.",
      data: {
        revokedLicenseKey: license?.licenseKey || null,
        transactionId: params.txId,
        refundId: op.id,
        refundStatus: op.status,
        paymentStatus: completed ? "REFUNDED" : "PAID",
        disbursementStatus: completed ? "CANCELLED" : undefined,
        refundedAmount: completed ? op.amount : 0,
      },
    };
  } catch (error) {
    set.status = error instanceof RefundRequestError ? error.status : 500;
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
