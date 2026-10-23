import { db } from "../../db";
import { transactions, paymentOperations } from "../../db/schema";
import { and, eq, inArray, ne, lte } from "drizzle-orm";
import { getPaymentGateway } from "./gateways";
import type {
  PaymentGatewayAdapter,
  GatewayDisbursementParams,
  GatewayMoneyStatus,
} from "./gateways/types";
import { normalizeMoneyStatus } from "./moneyStatus";

export class PayoutConflictError extends Error {}

export async function submitPayout(input: {
  transactionIds: string[];
  builderId: string;
  gateway: PaymentGatewayAdapter;
  recipient: Pick<GatewayDisbursementParams, "bankCode" | "accountNumber" | "accountHolderName">;
  description: string;
}) {
  if (input.gateway.id === "sandbox")
    throw new Error("Gateway sandbox tidak dapat mencairkan saldo live");
  const operation = await db.transaction(async (trx) => {
    const rows = await trx
      .select()
      .from(transactions)
      .where(
        and(
          inArray(transactions.id, input.transactionIds),
          eq(transactions.builderId, input.builderId),
          eq(transactions.paymentStatus, "PAID"),
          eq(transactions.mode, "live"),
          ne(transactions.paymentProvider, "sandbox"),
          inArray(transactions.refundStatus, ["NONE", "FAILED"]),
          eq(transactions.disbursementStatus, "PENDING")
        )
      )
      .orderBy(transactions.id)
      .for("update");
    if (!rows.length || rows.length !== new Set(input.transactionIds).size)
      throw new PayoutConflictError(
        "Pencairan sedang diproses atau transaksi tidak memenuhi syarat"
      );
    const id = `disb_${crypto.randomUUID()}`;
    const amount = rows.reduce((sum, row) => sum + row.netAmount, 0);
    const request = { externalId: id, amount, ...input.recipient, description: input.description };
    const [op] = await trx
      .insert(paymentOperations)
      .values({
        id,
        kind: "PAYOUT",
        provider: input.gateway.id,
        transactionIds: rows.map((r) => r.id),
        amount,
        request,
        status: "PROCESSING",
        nextCheckAt: new Date(Date.now() + 60_000),
      })
      .returning();
    await trx
      .update(transactions)
      .set({
        disbursementStatus: "PROCESSING",
        disbursementExternalId: id,
        payoutOperationId: id,
        updatedAt: new Date(),
      })
      .where(
        inArray(
          transactions.id,
          rows.map((r) => r.id)
        )
      );
    return op!;
  });
  try {
    const response = await input.gateway.createDisbursement(
      operation.request as unknown as GatewayDisbursementParams
    );
    const status = normalizeMoneyStatus(response.status);
    await applyPayoutResult(operation.id, { id: response.id, amount: response.amount, status });
    const saved = await db.query.paymentOperations.findFirst({
      where: eq(paymentOperations.id, operation.id),
    });
    return {
      ...response,
      amount: operation.amount,
      externalId: operation.id,
      status: saved?.status || status,
    };
  } catch (error) {
    // The provider may already have accepted the transfer. Never unlock these
    // transactions or submit a replacement transfer after a transport failure.
    await db
      .update(paymentOperations)
      .set({ status: "UNKNOWN", lastError: String(error), updatedAt: new Date() })
      .where(
        and(eq(paymentOperations.id, operation.id), eq(paymentOperations.status, "PROCESSING"))
      );
    const saved = await db.query.paymentOperations.findFirst({
      where: eq(paymentOperations.id, operation.id),
    });
    return {
      id: saved?.providerId || "",
      externalId: operation.id,
      amount: operation.amount,
      status: saved?.status || ("UNKNOWN" as const),
      ...input.recipient,
    };
  }
}

export async function applyPayoutResult(operationId: string, result: GatewayMoneyStatus) {
  return db.transaction(async (trx) => {
    const [op] = await trx
      .select()
      .from(paymentOperations)
      .where(eq(paymentOperations.id, operationId))
      .for("update");
    if (!op || op.kind !== "PAYOUT" || ["COMPLETED", "FAILED"].includes(op.status)) return;
    if (result.amount !== undefined && result.amount !== op.amount)
      throw new Error("Nominal payout provider tidak cocok");
    await trx
      .update(paymentOperations)
      .set({
        status: result.status,
        providerId: result.id || op.providerId,
        nextCheckAt: new Date(Date.now() + 60_000),
        updatedAt: new Date(),
      })
      .where(eq(paymentOperations.id, op.id));
    await trx
      .update(transactions)
      .set({
        disbursementStatus:
          result.status === "COMPLETED"
            ? "COMPLETED"
            : result.status === "FAILED"
              ? "FAILED"
              : "PROCESSING",
        disbursementId: result.id || op.providerId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(transactions.payoutOperationId, op.id),
          eq(transactions.disbursementStatus, "PROCESSING")
        )
      );
  });
}

/** Reconciliation only reads provider state; it never submits a transfer. */
export async function reconcilePayouts() {
  const due = await db.query.paymentOperations.findMany({
    where: and(
      eq(paymentOperations.kind, "PAYOUT"),
      inArray(paymentOperations.status, ["PROCESSING", "UNKNOWN"]),
      lte(paymentOperations.nextCheckAt, new Date())
    ),
    limit: 50,
  });
  for (const op of due) {
    try {
      const gateway = getPaymentGateway(op.provider);
      if (gateway.queryDisbursement)
        await applyPayoutResult(
          op.id,
          await gateway.queryDisbursement({ id: op.providerId || undefined, externalId: op.id })
        );
    } catch (error) {
      await db
        .update(paymentOperations)
        .set({ lastError: String(error), updatedAt: new Date() })
        .where(eq(paymentOperations.id, op.id));
    } finally {
      await db
        .update(paymentOperations)
        .set({ nextCheckAt: new Date(Date.now() + 60_000) })
        .where(eq(paymentOperations.id, op.id));
    }
  }
}

export async function applyPayoutCallback(
  provider: string,
  externalId: string | undefined,
  providerId: string | undefined,
  status: unknown
) {
  const op = externalId
    ? await db.query.paymentOperations.findFirst({
        where: and(
          eq(paymentOperations.id, externalId),
          eq(paymentOperations.provider, provider),
          eq(paymentOperations.kind, "PAYOUT")
        ),
      })
    : providerId
      ? await db.query.paymentOperations.findFirst({
          where: and(
            eq(paymentOperations.providerId, providerId),
            eq(paymentOperations.provider, provider),
            eq(paymentOperations.kind, "PAYOUT")
          ),
        })
      : undefined;
  if (op) await applyPayoutResult(op.id, { id: providerId, status: normalizeMoneyStatus(status) });
}
