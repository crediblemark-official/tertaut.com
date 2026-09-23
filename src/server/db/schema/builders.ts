import { pgTable, text, timestamp, uuid, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const builders = pgTable(
  "builders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Akun Better Auth pemilik profil builder ini (null untuk data legacy/belum diklaim). */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    apiKey: text("api_key").notNull().unique(),
    /** Secret API key untuk server-to-server (S2S): `tt_secret_...`. Hanya dipakai di backend pembangun. */
    secretApiKey: text("secret_api_key").notNull().default(""),
    isSuspended: boolean("is_suspended").default(false).notNull(),
    disbursementAccount: jsonb("disbursement_account").$type<{
      bankCode?: string;
      accountNumber?: string;
      accountHolderName?: string;
      eWalletType?: string;
      phoneNumber?: string;
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_builders_user_id").on(table.userId)]
);

export type Builder = typeof builders.$inferSelect;
export type NewBuilder = typeof builders.$inferInsert;
