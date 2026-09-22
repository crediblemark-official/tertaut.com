import { pgTable, text, timestamp, uuid, integer, boolean, index } from "drizzle-orm/pg-core";
import { apps } from "./apps";
import { builders } from "./builders";

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(), // e.g. "tx_xyz123"
  appId: text("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  builderId: uuid("builder_id")
    .notNull()
    .references(() => builders.id, { onDelete: "cascade" }),
  paymentProvider: text("payment_provider").default("dana").notNull(), // "dana"
  providerReferenceId: text("provider_reference_id"), // Order ID / Reference ID dari gateway
  xenditInvoiceId: text("xendit_invoice_id").unique(),
  xenditExternalId: text("xendit_external_id").notNull(),
  xenditInvoiceUrl: text("xendit_invoice_url"),
  customerEmail: text("customer_email").notNull(),
  grossAmount: integer("gross_amount").notNull(), // e.g. 49000
  platformFee: integer("platform_fee").notNull(), // 5% = 2450
  netAmount: integer("net_amount").notNull(), // 95% = 46550
  paymentChannel: text("payment_channel"), // e.g. QRIS, BCA, GOPAY
  paymentStatus: text("payment_status", {
    enum: ["PENDING", "PAID", "EXPIRED", "FAILED"],
  })
    .default("PENDING")
    .notNull(),
  disbursementStatus: text("disbursement_status", {
    enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
  })
    .default("PENDING")
    .notNull(),
  disbursementId: text("disbursement_id"),
  couponCode: text("coupon_code"), // Kupon yang ditebus (null = harga penuh)
  discountAmount: integer("discount_amount").default(0).notNull(), // Nominal IDR yang dipotong
  grantDays: integer("grant_days").default(30),
  // Jumlah kredit yang ditambahkan ke ledger lisensi saat pembayaran terkonfirmasi.
  grantCredits: integer("grant_credits").default(0),
  // Flag order mock (sandbox/forceMock): hanya transaksi mock yang boleh di-fulfill
  // lewat ?mock=true pada finish redirect. Aplikasi Live TIDAK boleh di-fulfill via mock.
  mockOrder: boolean("mock_order").default(false).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Composite index untuk query saldo & pencairan per builder (payouts/trigger)
  index("idx_transactions_builder_payout").on(
    table.builderId,
    table.paymentStatus,
    table.disbursementStatus
  ),
  index("idx_transactions_app_id").on(table.appId),
  index("idx_transactions_app_payment_status").on(table.appId, table.paymentStatus),
  index("idx_transactions_customer_email").on(table.customerEmail),
  index("idx_transactions_xendit_ext_id").on(table.xenditExternalId),
  index("idx_transactions_created_at").on(table.createdAt),
]);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
