import { pgTable, text, timestamp, uuid, jsonb, index } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const builders = pgTable("builders", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Akun Better Auth pemilik profil builder ini (null untuk data legacy/belum diklaim). */
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
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
}, (table) => [
  index("idx_builders_user_id").on(table.userId),
]);

export type Builder = typeof builders.$inferSelect;
export type NewBuilder = typeof builders.$inferInsert;
