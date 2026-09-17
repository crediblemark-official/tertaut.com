import { pgTable, text, timestamp, uuid, integer, jsonb, index } from "drizzle-orm/pg-core";
import { builders } from "./builders";

export interface CaptureConfig {
  displayMode?: "inline" | "modal" | "sticky_bar" | "exit_intent";
  headline?: string;
  description?: string;
  buttonText?: string;
  successMessage?: string;
  couponCode?: string;
  whatsappNumber?: string;
  whatsappMessage?: string;
  priceTiers?: { id: string; name: string; price: number; badge?: string; perks?: string[] }[];
  featuresToVote?: { id: string; title: string; description?: string; votes?: number }[];
  qualifierQuestions?: {
    id: string;
    question: string;
    type: "select" | "text" | "radio";
    options?: string[];
  }[];
  painPointPrompt?: string;
  interviewReward?: string;
  calendarLink?: string;
}

export const apps = pgTable("apps", {
  id: text("id").primaryKey(), // e.g. "app_xyz123"
  builderId: uuid("builder_id")
    .notNull()
    .references(() => builders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // e.g. "fastmail-ai" for tertaut.com/v/:slug
  mode: text("mode", { enum: ["sandbox", "live"] })
    .default("sandbox")
    .notNull(),
  targetPrice: integer("target_price").default(0).notNull(), // dalam IDR
  description: text("description"),
  headline: text("headline"),
  subheadline: text("subheadline"),
  mediaUrl: text("media_url"),
  valueProps: jsonb("value_props").$type<string[]>(),
  ctaText: text("cta_text").default("Beli Sekarang"),
  customIntentMessage: text("custom_intent_message"),
  pageBlocks: jsonb("page_blocks").$type<any[]>(),
  customHtml: text("custom_html"),
  captureConfig: jsonb("capture_config").$type<CaptureConfig>(),
  webhookUrl: text("webhook_url"),
  redirectUrl: text("redirect_url"), // URL redirect balik (situsbisnis.com)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_apps_builder_id").on(table.builderId),
  index("idx_apps_mode").on(table.mode),
]);

export type App = typeof apps.$inferSelect;
export type NewApp = typeof apps.$inferInsert;
