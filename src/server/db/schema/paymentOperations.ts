import { pgTable, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/** A durable money-out attempt. UNKNOWN is never automatically resubmitted. */
export const paymentOperations = pgTable(
  "payment_operations",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: ["PAYOUT", "REFUND"] }).notNull(),
    provider: text("provider").notNull(),
    transactionIds: jsonb("transaction_ids").$type<string[]>().notNull(),
    amount: integer("amount").notNull(),
    request: jsonb("request").$type<Record<string, unknown>>().notNull(),
    status: text("status", { enum: ["PROCESSING", "UNKNOWN", "COMPLETED", "FAILED"] }).notNull(),
    providerId: text("provider_id"),
    lastError: text("last_error"),
    nextCheckAt: timestamp("next_check_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_payment_operations_reconcile").on(t.status, t.nextCheckAt)]
);
