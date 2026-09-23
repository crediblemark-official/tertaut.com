import { db } from "../../db";
import { aiProxyLogs } from "../../db/schema";
import { eq } from "drizzle-orm";
import { resolveCurrentBuilder } from "../apps/builder";
import { verifyOwnedApp } from "../../lib/ownership";

/**
 * Riwayat panggilan AI Proxy (Audit Log)
 */
export async function handleGetAiLogs({ params: { appId }, query, request, set }: any) {
  const { builder, isAdmin } = request?.headers
    ? await resolveCurrentBuilder(request.headers)
    : !request
      ? { builder: null, isAdmin: true }
      : { builder: null, isAdmin: false };

  if (!isAdmin && !builder) {
    set.status = 401;
    return { success: false, error: "Unauthorized" };
  }

  if (!isAdmin && builder) {
    const owned = await verifyOwnedApp(builder.id, appId, isAdmin);
    if ("error" in owned) {
      set.status = owned.status;
      return { success: false, error: owned.error };
    }
  }

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
