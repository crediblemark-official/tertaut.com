import { randomBytes } from "crypto";
import { db } from "../db";
import { licenseEvents } from "../db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export type AuditActorType = "ADMIN" | "BUILDER" | "S2S" | "SYSTEM" | "CLIENT";

export interface AuditContext {
  licenseId?: string | null;
  licenseKey?: string | null;
  appId?: string | null;
  actorType: AuditActorType;
  actorId?: string | null;
  ipAddress?: string | null;
}

export interface AuditQueryOptions {
  licenseKey?: string;
  appId?: string;
  appIds?: string[];
  event?: string;
  actorType?: string;
  limit?: number;
  offset?: number;
}

/**
 * Audit log event-sourced (append-only). Tidak pernah di-update/di-hapus;
 * cukup untuk compliance & debugging tanpa mengubah data live.
 */
export class AuditService {
  static async record(
    event: string,
    ctx: AuditContext,
    payload: Record<string, any> = {}
  ): Promise<void> {
    try {
      await db.insert(licenseEvents).values({
        id: `evt_${randomBytes(8).toString("hex")}`,
        licenseId: ctx.licenseId || null,
        licenseKey: ctx.licenseKey || null,
        appId: ctx.appId || null,
        event,
        actorType: ctx.actorType,
        actorId: ctx.actorId || null,
        payload,
        ipAddress: ctx.ipAddress || null,
      });
    } catch (err: any) {
      // Audit tidak boleh mengganggu jalur kritis (best-effort).
      console.error("[Audit] gagal mencatat event:", err?.message || err);
    }
  }

  static async query(options: AuditQueryOptions) {
    const conditions: any[] = [];
    if (options.licenseKey)
      conditions.push(eq(licenseEvents.licenseKey, options.licenseKey.trim()));
    if (options.appId) conditions.push(eq(licenseEvents.appId, options.appId));
    if (options.appIds && options.appIds.length > 0)
      conditions.push(inArray(licenseEvents.appId, options.appIds));
    if (options.event) conditions.push(eq(licenseEvents.event, options.event));
    if (options.actorType) conditions.push(eq(licenseEvents.actorType as any, options.actorType));

    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
    const offset = Math.max(Number(options.offset) || 0, 0);

    const [totalRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(licenseEvents)
      .where(conditions.length ? and(...conditions) : undefined);

    const rows = await db.query.licenseEvents.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      orderBy: (e, { desc }) => [desc(e.createdAt)],
      limit,
      offset,
    });

    return {
      success: true,
      events: rows,
      total: Number(totalRes?.count ?? 0),
      limit,
      offset,
    };
  }
}
