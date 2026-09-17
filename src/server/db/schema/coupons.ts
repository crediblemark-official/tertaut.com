import { pgTable, text, timestamp, integer, boolean, index, unique } from "drizzle-orm/pg-core";
import { apps } from "./apps";

/**
 * Sistem Kupon Diskon (Modul 1: Monetization)
 * Kupon dapat bersifat global (appId = null) atau terikat ke satu aplikasi.
 * Penebusan dilakukan atomik via kolom redemptionCount (optimistic increment).
 */
export const coupons = pgTable(
  "coupons",
  {
    id: text("id").primaryKey(), // e.g. "cpn_xyz123"
    code: text("code").notNull().unique(), // e.g. "EARLY50" (disimpan uppercase)
    appId: text("app_id").references(() => apps.id, { onDelete: "cascade" }), // null = berlaku untuk semua app
    discountPercent: integer("discount_percent").notNull(), // 1-100
    maxRedemptions: integer("max_redemptions").default(0).notNull(), // 0 = unlimited
    redemptionCount: integer("redemption_count").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_coupons_app_id").on(table.appId),
    unique("unique_app_code").on(table.appId, table.code),
  ]
);

export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;
