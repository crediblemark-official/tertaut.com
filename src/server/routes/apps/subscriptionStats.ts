import { db } from "../../db";
import { apps, licenses, transactions } from "../../db/schema";
import { sql } from "drizzle-orm";
import { resolveCurrentBuilder } from "./builder";

/** Metrics use the entire scoped ledger, not a client-side page or catalog prices. */
export async function handleSubscriptionStats({ request, query, set }: any) {
  const { builder, isAdmin } = await resolveCurrentBuilder(request.headers);
  if (!isAdmin && !builder) {
    set.status = 403;
    return { error: "Profil builder tidak tersedia" };
  }
  const scope = isAdmin ? sql`true` : sql`${apps.builderId} = ${builder!.id}`;
  const mode = query?.mode === "sandbox" ? "sandbox" : "live";
  const [result] = await db.execute(sql`
    WITH scoped AS (SELECT ${apps.id} AS id FROM ${apps} WHERE ${scope} AND ${apps.mode} = ${mode}),
    ledger AS (
      SELECT t.* FROM ${transactions} t JOIN scoped s ON s.id = t.app_id
      WHERE t.mode = ${mode} AND t.payment_status = 'PAID' AND t.gross_amount > 0
        AND t.payment_channel IS DISTINCT FROM 'FREE_TRIAL'
    ), entitled AS (
      SELECT l.* FROM ${licenses} l JOIN scoped s ON s.id = l.app_id WHERE l.mode = ${mode}
    ), paid_active AS (
      SELECT DISTINCT ON (lower(l.customer_email), l.app_id) l.id, t.gross_amount, t.grant_days
      FROM entitled l JOIN ledger t ON t.id = l.transaction_id
      JOIN ${apps} a ON a.id = l.app_id
      WHERE l.status = 'ACTIVE' AND (l.expires_at IS NULL OR l.expires_at > now()) AND a.pricing_type = 'subscription'
      ORDER BY lower(l.customer_email), l.app_id, t.paid_at DESC NULLS LAST, t.created_at DESC, t.id DESC
    )
    SELECT
      (SELECT count(*)::int FROM entitled) AS "totalCount",
      (SELECT count(*)::int FROM entitled WHERE status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > now())) AS "activeCount",
      (SELECT count(*)::int FROM paid_active) AS "activeRecurringCount",
      (SELECT coalesce(round(sum(gross_amount * 30.4375 / nullif(grant_days, 0))),0)::bigint FROM paid_active) AS "monthlyEquivalent",
      (SELECT coalesce(round(sum(gross_amount)::numeric / nullif(count(DISTINCT lower(customer_email)),0)),0)::bigint FROM ledger) AS "avgLtv",
      (SELECT count(*)::int FROM entitled WHERE status = 'ACTIVE' AND expires_at > now() AND expires_at <= now() + interval '7 days') AS "expiringSoon"
  `);
  return {
    success: true,
    billingMode: "manual",
    stats: Object.fromEntries(
      Object.entries(result || {}).map(([key, value]) => [key, Number(value)])
    ),
  };
}
