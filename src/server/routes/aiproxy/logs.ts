import { db } from "../../db";
import { aiProxyLogs } from "../../db/schema";
import { eq } from "drizzle-orm";

/**
 * Riwayat panggilan AI Proxy (Audit Log)
 */
export async function handleGetAiLogs({ params: { appId }, query }: any) {
  const { limit = 50 } = query as any;
  const logs = await db.query.aiProxyLogs.findMany({
    where: eq(aiProxyLogs.appId, appId),
    orderBy: (log, { desc }) => [desc(log.createdAt)],
    limit: Number(limit),
  });

  return {
    success: true,
    logs,
  };
}
