import { pgTable, text, timestamp, integer, unique, index, jsonb, uuid, boolean } from "drizzle-orm/pg-core";
import { apps } from "./apps";
import { transactions } from "./transactions";
import { builders } from "./builders";

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
  licenseVersion: integer("license_version").default(1).notNull(),
  features: jsonb("features").$type<Record<string, any>>().default({}),
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

/**
 * Floating license: satu "seat" diwakili satu lease ber-TTL.
 * Client wajib mengirim heartbeat periodik; lease yang tidak diperbarui
 * akan lepas otomatis dan slotnya dipakai device lain (rolling seat).
 */
export const licenseLeases = pgTable(
  "license_leases",
  {
    id: text("id").primaryKey(),
    licenseId: text("license_id")
      .notNull()
      .references(() => licenses.id, { onDelete: "cascade" }),
    hwidHash: text("hwid_hash").notNull(),
    deviceName: text("device_name"),
    /** Kunci acak yang wajib dipresentasikan client tiap heartbeat (anti-hijack seat). */
    leaseKey: text("lease_key").notNull(),
    ipAddress: text("ip_address"),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("unique_license_lease_hwid").on(table.licenseId, table.hwidHash),
    index("idx_license_leases_license_id").on(table.licenseId),
    index("idx_license_leases_expires_at").on(table.expiresAt),
  ]
);

/**
 * Webhook endpoint milik builder untuk menerima peristiwa lifecycle lisensi.
 * Secret dipakai sebagai kunci HMAC-SHA256 penanda `X-Tertaut-Signature`.
 */
export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: text("id").primaryKey(),
    builderId: uuid("builder_id")
      .notNull()
      .references(() => builders.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    events: text("events").array().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_webhook_endpoints_builder").on(table.builderId),
  ]
);

/**
 * Outbox pengiriman webhook (antrian + retry exponential backoff).
 * Payload disimpan utuh agar bisa di-resend identik setelah gagal.
 */
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    endpointId: text("endpoint_id")
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    /** Nama event, mis. license.issued / license.expired / credits.insufficient */
    event: text("event").notNull(),
    /** Payload JSON mentah yang dikirim (sebelum ditandatangani). */
    payload: jsonb("payload").$type<Record<string, any>>().notNull(),
    signature: text("signature"),
    status: text("status", {
      enum: ["PENDING", "SENT", "FAILED"],
    })
      .default("PENDING")
      .notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_webhook_deliveries_status").on(table.status, table.nextRetryAt),
    index("idx_webhook_deliveries_endpoint").on(table.endpointId),
  ]
);

/**
 * Audit log event-sourced (append-only) untuk compliance & debugging.
 * Tidak pernah di-update atau dihapus.
 */
export const licenseEvents = pgTable(
  "license_events",
  {
    id: text("id").primaryKey(),
    licenseId: text("license_id").references(() => licenses.id, { onDelete: "cascade" }),
    licenseKey: text("license_key"),
    appId: text("app_id"),
    event: text("event").notNull(),
    actorType: text("actor_type", {
      enum: ["ADMIN", "BUILDER", "S2S", "SYSTEM", "CLIENT"],
    }).notNull(),
    actorId: text("actor_id"),
    payload: jsonb("payload").$type<Record<string, any>>().default({}),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_license_events_license_id").on(table.licenseId),
    index("idx_license_events_app_id").on(table.appId),
    index("idx_license_events_event").on(table.event),
    index("idx_license_events_created_at").on(table.createdAt),
  ]
);

export type License = typeof licenses.$inferSelect;
export type NewLicense = typeof licenses.$inferInsert;
export type LicenseActivation = typeof licenseActivations.$inferSelect;
export type NewLicenseActivation = typeof licenseActivations.$inferInsert;
export type RevokedToken = typeof revokedTokens.$inferSelect;
export type NewRevokedToken = typeof revokedTokens.$inferInsert;
export type LicenseLease = typeof licenseLeases.$inferSelect;
export type NewLicenseLease = typeof licenseLeases.$inferInsert;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
export type LicenseEvent = typeof licenseEvents.$inferSelect;
export type NewLicenseEvent = typeof licenseEvents.$inferInsert;
