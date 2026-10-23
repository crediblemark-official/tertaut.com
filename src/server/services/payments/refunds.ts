import { db } from "../../db";
import {
  transactions,
  paymentOperations,
  licenses,
  revokedTokens,
  licenseEvents,
} from "../../db/schema";
import { and, eq, inArray, lte } from "drizzle-orm";
import { normalizeGatewayId } from "./gateways/registry";
import { getPaymentGateway } from "./gateways";
import { LicenseTokenService } from "../licensing/licenseToken";
import { WebhookService } from "../notifications/webhooks";
import type { GatewayMoneyStatus, GatewayRefundParams } from "./gateways/types";

export class RefundRequestError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export async function requestRefund(transactionId: string, reason: string) {
  const tx = await db.query.transactions.findFirst({ where: eq(transactions.id, transactionId) });
  if (!tx) throw new RefundRequestError("Transaksi tidak ditemukan", 404);
  if (tx.paymentStatus !== "PAID")
    throw new RefundRequestError("Hanya transaksi PAID yang dapat di-refund", 400);
  const provider = tx.mode === "sandbox" ? "sandbox" : normalizeGatewayId(tx.paymentProvider);
  if (!provider || (tx.mode === "live" && provider === "sandbox"))
    throw new RefundRequestError("Provider transaksi tidak valid untuk refund live", 422);
  const gateway = getPaymentGateway(provider);
  if (!gateway.createRefund)
    throw new RefundRequestError(
      `Refund otomatis belum didukung oleh ${gateway.displayName}. Gunakan proses refund provider.`,
      422
    );
  const prepared = await db.transaction(async (trx) => {
    const [locked] = await trx
      .select()
      .from(transactions)
      .where(eq(transactions.id, tx.id))
      .for("update");
    if (locked.paymentStatus !== "PAID")
      throw new RefundRequestError("Hanya transaksi PAID yang dapat di-refund", 400);
    if (["PROCESSING", "COMPLETED"].includes(locked.disbursementStatus))
      throw new RefundRequestError(
        "Dana sudah/sedang dicairkan. Rekonsiliasi pencairan sebelum melakukan refund.",
        409
      );
    if (locked.refundOperationId) {
      const existing = await trx.query.paymentOperations.findFirst({
        where: eq(paymentOperations.id, locked.refundOperationId),
      });
      if (existing && existing.status !== "FAILED") return { op: existing, submit: false };
    }
    const referenceNo = locked.providerReferenceId || locked.xenditInvoiceId || "";
    if (locked.mode === "live" && !referenceNo)
      throw new RefundRequestError("Referensi pembayaran provider tidak tersedia", 422);
    const id = `rfd_${crypto.randomUUID()}`;
    const request: GatewayRefundParams = {
      externalId: id,
      referenceNo,
      originalExternalId: locked.xenditExternalId,
      amount: locked.grossAmount,
      reason,
    };
    const [op] = await trx
      .insert(paymentOperations)
      .values({
        id,
        kind: "REFUND",
        provider: gateway.id,
        transactionIds: [tx.id],
        amount: tx.grossAmount,
        request: { ...request },
        status: "PROCESSING",
        nextCheckAt: new Date(Date.now() + 60_000),
      })
      .returning();
    await trx
      .update(transactions)
      .set({ refundStatus: "PROCESSING", refundOperationId: id, updatedAt: new Date() })
      .where(eq(transactions.id, tx.id));
    return { op: op!, submit: true };
  });
  if (prepared.submit) {
    let response: GatewayMoneyStatus | undefined;
    try {
      response = await gateway.createRefund(prepared.op.request as unknown as GatewayRefundParams);
      await applyRefundResult(prepared.op.id, response);
    } catch (error) {
      await applyRefundResult(prepared.op.id, { id: response?.id, status: "UNKNOWN" });
      await db
        .update(paymentOperations)
        .set({ lastError: String(error) })
        .where(eq(paymentOperations.id, prepared.op.id));
    }
  }
  return (await db.query.paymentOperations.findFirst({
    where: eq(paymentOperations.id, prepared.op.id),
  }))!;
}

export async function applyRefundResult(operationId: string, result: GatewayMoneyStatus) {
  return db.transaction(async (trx) => {
    // Lock the transaction first, matching requestRefund/payout lock ordering.
    const opSnapshot = await trx.query.paymentOperations.findFirst({
      where: eq(paymentOperations.id, operationId),
    });
    if (!opSnapshot || opSnapshot.kind !== "REFUND") return;
    const [tx] = await trx
      .select()
      .from(transactions)
      .where(eq(transactions.id, opSnapshot.transactionIds[0]!))
      .for("update");
    const [op] = await trx
      .select()
      .from(paymentOperations)
      .where(eq(paymentOperations.id, operationId))
      .for("update");
    if (!op || !tx || ["COMPLETED", "FAILED"].includes(op.status)) return;
    if (result.amount !== undefined && result.amount !== op.amount)
      throw new Error("Nominal refund provider tidak cocok");
    await trx
      .update(paymentOperations)
      .set({
        status: result.status,
        providerId: result.id || op.providerId,
        updatedAt: new Date(),
        nextCheckAt: new Date(Date.now() + 60_000),
      })
      .where(eq(paymentOperations.id, op.id));
    await trx
      .update(transactions)
      .set({
        refundStatus: result.status,
        ...(result.status === "COMPLETED"
          ? { paymentStatus: "REFUNDED" as const, disbursementStatus: "CANCELLED" as const }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id));
    if (result.status !== "COMPLETED") return;
    const [license] = await trx
      .select()
      .from(licenses)
      .where(eq(licenses.transactionId, tx.id))
      .for("update");
    if (!license || license.status === "REVOKED") return;
    await trx
      .update(licenses)
      .set({ status: "REVOKED", updatedAt: new Date() })
      .where(eq(licenses.id, license.id));
    if (license.offlineJwtGraceToken) {
      const decoded = await LicenseTokenService.verify(license.offlineJwtGraceToken);
      if (decoded.valid && decoded.claims)
        await trx
          .insert(revokedTokens)
          .values({
            jti: decoded.claims.jti,
            licenseId: license.id,
            licenseKey: license.licenseKey,
            reason: `REFUND: ${op.request.reason}`,
            expiresAt: new Date(decoded.claims.exp * 1000),
          })
          .onConflictDoNothing();
    }
    await trx.insert(licenseEvents).values({
      id: `evt_${crypto.randomUUID()}`,
      licenseId: license.id,
      appId: license.appId,
      licenseKey: license.licenseKey,
      actorType: "SYSTEM",
      event: "license.revoked",
      payload: { transactionId: tx.id, refundId: op.id },
    });
    await WebhookService.emit(
      "license.revoked",
      {
        license: { ...license, status: "REVOKED" },
        actorType: "SYSTEM",
        payload: { reason: "REFUND", transactionId: tx.id },
      },
      trx
    );
  });
}

export async function reconcileRefunds() {
  const due = await db.query.paymentOperations.findMany({
    where: and(
      eq(paymentOperations.kind, "REFUND"),
      inArray(paymentOperations.status, ["PROCESSING", "UNKNOWN"]),
      lte(paymentOperations.nextCheckAt, new Date())
    ),
    limit: 50,
  });
  for (const op of due) {
    try {
      const gateway = getPaymentGateway(op.provider);
      if (gateway.queryRefund)
        await applyRefundResult(
          op.id,
          await gateway.queryRefund({
            ...(op.request as unknown as GatewayRefundParams),
            id: op.providerId || undefined,
          })
        );
    } catch (error) {
      await db
        .update(paymentOperations)
        .set({ lastError: String(error) })
        .where(eq(paymentOperations.id, op.id));
    } finally {
      await db
        .update(paymentOperations)
        .set({ nextCheckAt: new Date(Date.now() + 60_000) })
        .where(eq(paymentOperations.id, op.id));
    }
  }
}
