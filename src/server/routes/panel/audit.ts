import { db } from "../../db";
import { licenseEvents } from "../../db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Audit Trail & Log Keamanan Sistem (Super Admin)
 */
export async function handlePanelAuditLogs({ query }: any) {
  const limit = Math.min(Number(query?.limit) || 100, 500);
  const actorFilter = query?.actorType;
  const eventFilter = query?.event;

  let whereClause;
  if (actorFilter && eventFilter) {
    whereClause = (e: any, { and, eq }: any) =>
      and(eq(e.actorType, actorFilter), eq(e.event, eventFilter));
  } else if (actorFilter) {
    whereClause = (e: any, { eq }: any) => eq(e.actorType, actorFilter);
  } else if (eventFilter) {
    whereClause = (e: any, { eq }: any) => eq(e.event, eventFilter);
  }

  const logs = await db.query.licenseEvents.findMany({
    where: whereClause,
    orderBy: [desc(licenseEvents.createdAt)],
    limit,
  });

  return {
    success: true,
    total: logs.length,
    logs: logs.map((l) => ({
      id: l.id,
      licenseId: l.licenseId,
      licenseKey: l.licenseKey,
      appId: l.appId,
      event: l.event,
      actorType: l.actorType,
      actorId: l.actorId,
      payload: l.payload || {},
      ipAddress: l.ipAddress || null,
      createdAt: l.createdAt,
    })),
  };
}
