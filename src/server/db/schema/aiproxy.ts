import { pgTable, text, timestamp, uuid, integer, boolean, unique, index } from "drizzle-orm/pg-core";
import { apps } from "./apps";
import { builders } from "./builders";
import { licenses } from "./licenses";

/**
 * Tabel Vault Kunci Provider AI (Terenkripsi AES-256-GCM)
 * Standar PRD Modul 4: FR-1.1 & FR-1.2
 */
export const aiProviderKeys = pgTable("ai_provider_keys", {
  id: text("id").primaryKey(), // e.g. "key_xyz123"
  builderId: uuid("builder_id")
    .notNull()
    .references(() => builders.id, { onDelete: "cascade" }),
  providerName: text("provider_name").notNull(), // OPENAI, ANTHROPIC, GEMINI, DEEPSEEK, CUSTOM
  keyName: text("key_name").notNull(), // e.g. "OpenAI Production Key"
  encryptedApiKey: text("encrypted_api_key").notNull(), // AES-256-GCM
  ivVector: text("iv_vector").notNull(),
  authTag: text("auth_tag"),
  baseUrl: text("base_url"), // Optional for custom Ollama / Groq
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("idx_ai_provider_keys_builder_id").on(table.builderId)]);

/**
 * Tabel Konfigurasi Model & Guardrails Aplikasi
 * Standar PRD Modul 4: FR-3.2 (Cost Guardrails & Token Allocation)
 */
export const aiAppConfigs = pgTable(
  "ai_app_configs",
  {
    id: text("id").primaryKey(), // e.g. "cfg_xyz123"
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    providerKeyId: text("provider_key_id").references(() => aiProviderKeys.id, {
      onDelete: "set null",
    }),
    modelAlias: text("model_alias").notNull(), // e.g. "fast-summary-model"
    targetModelName: text("target_model_name").notNull(), // e.g. "gpt-4o-mini", "gemini-1.5-flash"
    maxRequestsPerMin: integer("max_requests_per_min").default(15).notNull(),
    dailyTokenLimit: integer("daily_token_limit").default(100000).notNull(), // 0 = Unlimited
    monthlyBudgetIdr: integer("monthly_budget_idr").default(500000).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("unique_app_model_alias").on(table.appId, table.modelAlias),
    index("idx_ai_app_configs_app_id").on(table.appId),
    index("idx_ai_app_configs_provider_key_id").on(table.providerKeyId),
  ]
);

/**
 * Tabel Log Penggunaan Token (Statistik Anonim - Zero Prompt Retention)
 * Standar PRD Modul 4: FR-3.1 & FR-4.2
 */
export const aiUsageLogs = pgTable("ai_usage_logs", {
  id: text("id").primaryKey(), // e.g. "log_xyz123"
  licenseId: text("license_id").references(() => licenses.id, { onDelete: "set null" }),
  appId: text("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  modelAlias: text("model_alias").notNull(),
  promptTokens: integer("prompt_tokens").default(0).notNull(),
  completionTokens: integer("completion_tokens").default(0).notNull(),
  totalTokens: integer("total_tokens").default(0).notNull(),
  responseTimeMs: integer("response_time_ms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_usage_logs_license_id").on(table.licenseId),
  index("idx_ai_usage_logs_app_id").on(table.appId),
  index("idx_ai_usage_logs_created_at").on(table.createdAt),
]);

/**
 * Legacy Vault Credentials & Proxy Logs for Backward Compatibility
 */
export const aiVaultCredentials = pgTable("ai_vault_credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  appId: text("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["openai", "anthropic", "gemini", "deepseek", "custom"] }).notNull(),
  encryptedApiKey: text("encrypted_api_key").notNull(), // Encrypted via AES-256-GCM
  iv: text("iv").notNull(), // Initialization vector
  authTag: text("auth_tag").notNull(), // Authentication tag
  monthlyBudgetLimit: integer("monthly_budget_limit").default(500000), // IDR
  currentMonthlyUsage: integer("current_monthly_usage").default(0),
  isKillSwitchActive: boolean("is_kill_switch_active").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_vault_credentials_app_id").on(table.appId),
  index("idx_ai_vault_credentials_provider").on(table.provider),
]);

export const aiProxyLogs = pgTable("ai_proxy_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  appId: text("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  licenseKey: text("license_key"),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),
  totalTokens: integer("total_tokens").default(0),
  latencyMs: integer("latency_ms").default(0),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_proxy_logs_app_id").on(table.appId),
  index("idx_ai_proxy_logs_license_key").on(table.licenseKey),
  index("idx_ai_proxy_logs_created_at").on(table.createdAt),
]);

export type AiProviderKey = typeof aiProviderKeys.$inferSelect;
export type NewAiProviderKey = typeof aiProviderKeys.$inferInsert;
export type AiAppConfig = typeof aiAppConfigs.$inferSelect;
export type NewAiAppConfig = typeof aiAppConfigs.$inferInsert;
export type AiUsageLog = typeof aiUsageLogs.$inferSelect;
export type NewAiUsageLog = typeof aiUsageLogs.$inferInsert;
export type AiVaultCredential = typeof aiVaultCredentials.$inferSelect;
export type NewAiVaultCredential = typeof aiVaultCredentials.$inferInsert;
export type AiProxyLog = typeof aiProxyLogs.$inferSelect;
export type NewAiProxyLog = typeof aiProxyLogs.$inferInsert;
