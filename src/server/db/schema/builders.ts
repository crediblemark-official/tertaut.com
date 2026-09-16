import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export const builders = pgTable("builders", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  apiKey: text("api_key").notNull().unique(),
  disbursementAccount: jsonb("disbursement_account").$type<{
    bankCode?: string;
    accountNumber?: string;
    accountHolderName?: string;
    eWalletType?: string;
    phoneNumber?: string;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Builder = typeof builders.$inferSelect;
export type NewBuilder = typeof builders.$inferInsert;
