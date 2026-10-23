import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projects } from "./projects";
import { builders } from "./builders";

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(), // e.g. "tx_xyz123"
    appId: text("app_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    builderId: uuid("builder_id")
      .notNull()
      .references(() => builders.id, { onDelete: "cascade" }),
    mode: text("mode", { enum: ["sandbox", "live"] })
      .default("live")
      .notNull(),
    paymentCode: text("payment_code"),
    qrDataUrl: text("qr_data_url"),
    paymentExpiresAt: timestamp("payment_expires_at", { withTimezone: true }),
    paymentProvider: text("payment_provider").default("xendit").notNull(), // Original payment provider
    providerReferenceId: text("provider_reference_id"), // Order ID / Reference ID dari gateway
    xenditInvoiceId: text("xendit_invoice_id").unique(),
    xenditExternalId: text("xendit_external_id").notNull(),
    xenditInvoiceUrl: text("xendit_invoice_url"),
    customerEmail: text("customer_email").notNull(),
    customerName: text("customer_name"),
    metadata: jsonb("metadata").$type<Record<string, any>>(),
    grossAmount: integer("gross_amount").notNull(), // e.g. 49000
    platformFee: integer("platform_fee").notNull(), // 5% = 2450
    netAmount: integer("net_amount").notNull(), // 95% = 46550
    paymentChannel: text("payment_channel"), // e.g. QRIS, BCA, GOPAY
    paymentStatus: text("payment_status", {
      enum: ["PENDING", "PAID", "EXPIRED", "FAILED", "REFUNDED"],
    })
      .default("PENDING")
      .notNull(),
    disbursementStatus: text("disbursement_status", {
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"],
    })
      .default("PENDING")
      .notNull(),
    refundStatus: text("refund_status", {
      enum: ["NONE", "PROCESSING", "UNKNOWN", "COMPLETED", "FAILED"],
    })
      .default("NONE")
      .notNull(),
    refundOperationId: text("refund_operation_id"),
    payoutOperationId: text("payout_operation_id"),
    disbursementId: text("disbursement_id"),
    disbursementExternalId: text("disbursement_external_id"),
    couponCode: text("coupon_code"), // Kupon yang ditebus (null = harga penuh)
    discountAmount: integer("discount_amount").default(0).notNull(), // Nominal IDR yang dipotong
    grantDays: integer("grant_days").default(30),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Composite index untuk query saldo & pencairan per builder (payouts/trigger)
    index("idx_transactions_builder_payout").on(
      table.builderId,
      table.paymentStatus,
      table.disbursementStatus
    ),
    index("idx_transactions_app_id").on(table.appId),
    index("idx_transactions_app_payment_status").on(table.appId, table.paymentStatus),
    index("idx_transactions_customer_email").on(table.customerEmail),
    uniqueIndex("uniq_transactions_xendit_ext_id").on(table.xenditExternalId),
    // Anti-TOCTOU free trial: maksimal SATU trial per (app, email). Index parsial
    // hanya berlaku untuk baris FREE_TRIAL sehingga invoice berbayar tidak terpengaruh.
    uniqueIndex("uniq_transactions_trial_per_app_email")
      .on(table.appId, table.customerEmail, table.paymentChannel)
      .where(sql`${table.paymentChannel} = 'FREE_TRIAL'`),
    index("idx_transactions_disbursement_id").on(table.disbursementId),
    index("idx_transactions_disbursement_external_id").on(table.disbursementExternalId),
    index("idx_transactions_created_at").on(table.createdAt),
  ]
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
