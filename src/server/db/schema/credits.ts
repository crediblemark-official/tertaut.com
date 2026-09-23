import { pgTable, text, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { apps } from "./apps";
import { licenses } from "./licenses";

/**
 * Ledger kredit append-only per lisensi.
 * Saldo = SUM(delta); `balanceAfter` menyimpan snapshot untuk audit.
 * delta positif = grant/refund, negatif = pemakaian (debit).
 */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: text("id").primaryKey(), // e.g. "crl_xyz123"
    licenseId: text("license_id")
      .notNull()
      .references(() => licenses.id, { onDelete: "cascade" }),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    customerEmail: text("customer_email").notNull(),
    type: text("type", {
      enum: ["GRANT", "DEBIT", "REFUND", "ADJUSTMENT"],
    }).notNull(),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reference: text("reference"), // transactionId / idempotency key dari pemanggil
    description: text("description"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_credit_ledger_license_id").on(table.licenseId, table.createdAt),
    index("idx_credit_ledger_app_id").on(table.appId),
    index("idx_credit_ledger_customer_email").on(table.customerEmail),
    uniqueIndex("uniq_credit_ledger_license_ref").on(table.licenseId, table.reference),
  ]
);

export type CreditLedgerEntry = typeof creditLedger.$inferSelect;
export type NewCreditLedgerEntry = typeof creditLedger.$inferInsert;
