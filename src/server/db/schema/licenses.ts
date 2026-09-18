import { pgTable, text, timestamp, integer, unique, index } from "drizzle-orm/pg-core";
import { apps } from "./apps";
import { transactions } from "./transactions";

export const licenses = pgTable("licenses", {
  id: text("id").primaryKey(), // e.g. "lic_xyz123"
  appId: text("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  transactionId: text("transaction_id")
    .references(() => transactions.id, { onDelete: "set null" }),
  licenseKey: text("license_key").notNull().unique(), // e.g. "TT-A1B2-C3D4-E5F6"
  customerEmail: text("customer_email").notNull(),
  hardwareId: text("hardware_id"), // Primary/first hardware binding
  platform: text("platform", {
    enum: ["web", "desktop", "chrome_extension", "android", "general"],
  }).default("general"),
  status: text("status", {
    enum: ["ACTIVE", "REVOKED", "EXPIRED"],
  })
    .default("ACTIVE")
    .notNull(),
  maxSeats: integer("max_seats").default(3).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
  offlineJwtGraceToken: text("offline_jwt_grace_token"), // Offline 30 days fallback token
  apiKey: text("api_key"), // Kunci API pelanggan (auto-provisioning apiAccess)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_licenses_app_id").on(table.appId),
  // Satu transaksi hanya boleh melahirkan satu lisensi (cegah double-issue).
  unique("unique_licenses_transaction_id").on(table.transactionId),
  unique("unique_licenses_api_key").on(table.apiKey),
  index("idx_licenses_customer_email").on(table.customerEmail),
  index("idx_licenses_status").on(table.status),
]);

export const licenseActivations = pgTable(
  "license_activations",
  {
    id: text("id").primaryKey(),
    licenseId: text("license_id")
      .notNull()
      .references(() => licenses.id, { onDelete: "cascade" }),
    hwidHash: text("hwid_hash").notNull(),
    deviceName: text("device_name"),
    ipAddress: text("ip_address"),
    lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("unique_license_hwid").on(table.licenseId, table.hwidHash),
    index("idx_license_activations_license_id").on(table.licenseId),
    index("idx_license_activations_hwid_hash").on(table.hwidHash),
  ]
);

/**
 * Denylist token offline (jti) agar token yang sudah beredar bisa dicabut.
 */
export const revokedTokens = pgTable(
  "revoked_tokens",
  {
    jti: text("jti").primaryKey(),
    licenseId: text("license_id").references(() => licenses.id, { onDelete: "cascade" }),
    licenseKey: text("license_key"),
    reason: text("reason").default("REVOKED"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_revoked_tokens_license_id").on(table.licenseId),
    index("idx_revoked_tokens_expires_at").on(table.expiresAt),
  ]
);

export type License = typeof licenses.$inferSelect;
export type NewLicense = typeof licenses.$inferInsert;
export type LicenseActivation = typeof licenseActivations.$inferSelect;
export type NewLicenseActivation = typeof licenseActivations.$inferInsert;
export type RevokedToken = typeof revokedTokens.$inferSelect;
export type NewRevokedToken = typeof revokedTokens.$inferInsert;
