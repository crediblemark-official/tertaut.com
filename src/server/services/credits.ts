import { eq, and, desc, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "../db";
import { creditLedger, licenses } from "../db/schema";

export interface CreditContext {
  licenseId: string;
  appId: string;
  customerEmail: string;
}

export interface CreditEntryOptions {
  reference?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Executor transaksi (dipakai agar grant ikut atomik dengan pembuatan lisensi). */
  executor?: any;
}

export type DebitResult =
  | { ok: true; balance: number; consumed: number }
  | { ok: false; reason: "LICENSE_NOT_FOUND" | "INSUFFICIENT_CREDITS"; balance: number };

function assertPositiveInteger(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("[Credits] amount harus berupa bilangan bulat positif.");
  }
}

export class CreditService {
  static async getBalance(licenseId: string, executor: any = db): Promise<number> {
    const [row] = await executor
      .select({
        balance: sql<number>`coalesce(sum(${creditLedger.delta}), 0)`.mapWith(Number),
      })
      .from(creditLedger)
      .where(eq(creditLedger.licenseId, licenseId));

    return Number(row?.balance ?? 0);
  }

  /** Tambah kredit secara atomik. Baris lisensi dikunci (`FOR UPDATE`) agar saldo konsisten. */
  static async grant(
    ctx: CreditContext,
    amount: number,
    options: CreditEntryOptions = {}
  ): Promise<number> {
    assertPositiveInteger(amount);

    const performGrant = async (trx: any) => {
      // Kunci baris lisensi untuk serialisasi konkuren grant
      await trx
        .select({ id: licenses.id })
        .from(licenses)
        .where(eq(licenses.id, ctx.licenseId))
        .for("update");

      const balance = await this.getBalance(ctx.licenseId, trx);
      const balanceAfter = balance + amount;

      await trx.insert(creditLedger).values({
        id: `crl_${randomBytes(8).toString("hex")}`,
        licenseId: ctx.licenseId,
        appId: ctx.appId,
        customerEmail: ctx.customerEmail,
        type: "GRANT",
        delta: amount,
        balanceAfter,
        reference: options.reference ?? null,
        description: options.description ?? "Credit granted",
        metadata: options.metadata ?? null,
      });

      return balanceAfter;
    };

    if (options.executor) {
      return await performGrant(options.executor);
    }
    return await db.transaction(performGrant);
  }

  /**
   * Kurangi kredit secara atomik. Baris lisensi dikunci (`FOR UPDATE`) agar
   * dua debit paralel tidak menghasilkan saldo negatif.
   * Idempotensi: bila `reference` sudah pernah di-debit untuk lisensi ini,
   * kembalikan hasil sebelumnya tanpa memotong dua kali.
   */
  static async debit(
    ctx: CreditContext,
    amount: number,
    options: CreditEntryOptions = {}
  ): Promise<DebitResult> {
    assertPositiveInteger(amount);

    return await db.transaction(async (trx) => {
      const [lic] = await trx
        .select({ id: licenses.id })
        .from(licenses)
        .where(eq(licenses.id, ctx.licenseId))
        .for("update");

      if (!lic) {
        return { ok: false as const, reason: "LICENSE_NOT_FOUND" as const, balance: 0 };
      }

      if (options.reference) {
        const [existing] = await trx
          .select({ balanceAfter: creditLedger.balanceAfter })
          .from(creditLedger)
          .where(
            and(
              eq(creditLedger.licenseId, ctx.licenseId),
              eq(creditLedger.reference, options.reference)
            )
          )
          .limit(1);
        if (existing) {
          return { ok: true as const, balance: existing.balanceAfter, consumed: 0 };
        }
      }

      const balance = await this.getBalance(ctx.licenseId, trx);
      if (balance < amount) {
        return { ok: false as const, reason: "INSUFFICIENT_CREDITS" as const, balance };
      }

      const balanceAfter = balance - amount;
      await trx.insert(creditLedger).values({
        id: `crl_${randomBytes(8).toString("hex")}`,
        licenseId: ctx.licenseId,
        appId: ctx.appId,
        customerEmail: ctx.customerEmail,
        type: "DEBIT",
        delta: -amount,
        balanceAfter,
        reference: options.reference ?? null,
        description: options.description ?? "Credit consumed",
        metadata: options.metadata ?? null,
      });

      return { ok: true as const, balance: balanceAfter, consumed: amount };
    });
  }

  static async history(
    licenseId: string,
    limit = 50,
    executor: any = db
  ): Promise<Array<{ id: string; type: string; delta: number; balanceAfter: number; reference: string | null; description: string | null; createdAt: Date }>> {
    const rows = await executor
      .select({
        id: creditLedger.id,
        type: creditLedger.type,
        delta: creditLedger.delta,
        balanceAfter: creditLedger.balanceAfter,
        reference: creditLedger.reference,
        description: creditLedger.description,
        createdAt: creditLedger.createdAt,
      })
      .from(creditLedger)
      .where(eq(creditLedger.licenseId, licenseId))
      .orderBy(desc(creditLedger.createdAt))
      .limit(Math.min(Math.max(limit, 1), 200));

    return rows;
  }
}
