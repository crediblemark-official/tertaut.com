import { db } from "../../db";
import { paymentOperations } from "../../db/schema";
import { eq, and, or } from "drizzle-orm";
import { XenditService } from "../../services/payments/xendit";
import { applyRefundResult } from "../../services/payments/refunds";
import { normalizeMoneyStatus } from "../../services/payments/moneyStatus";

export async function handleXenditRefundWebhook({ headers, body, set }: any) {
  if (!(await XenditService.verifyWebhook(headers["x-callback-token"]))) {
    set.status = 401;
    return { error: "Invalid callback verification token" };
  }
  const data = body?.data || body || {};
  const identities = [];
  if (data.reference_id) identities.push(eq(paymentOperations.id, data.reference_id));
  if (data.id) identities.push(eq(paymentOperations.providerId, data.id));
  if (!identities.length) {
    set.status = 400;
    return { error: "Refund reference missing" };
  }
  const op = await db.query.paymentOperations.findFirst({
    where: and(
      eq(paymentOperations.kind, "REFUND"),
      eq(paymentOperations.provider, "xendit"),
      or(...identities)
    ),
  });
  if (op) {
    if (data.currency && data.currency !== "IDR") {
      set.status = 400;
      return { error: "Refund currency mismatch" };
    }
    const status = normalizeMoneyStatus(data.status);
    if (
      status === "COMPLETED" &&
      (!Number.isFinite(Number(data.amount)) || Number(data.amount) !== op.amount)
    ) {
      set.status = 400;
      return { error: "Refund amount mismatch" };
    }
    await applyRefundResult(op.id, {
      id: data.id,
      amount: data.amount === undefined ? undefined : Number(data.amount),
      status,
    });
  }
  return { received: true };
}
