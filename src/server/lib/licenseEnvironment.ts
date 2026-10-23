import { db } from "../db";
import { apps } from "../db/schema";
import { eq } from "drizzle-orm";

/** A sandbox license must never become a live entitlement after an app mode switch. */
export async function matchesLicenseEnvironment(license: { appId: string; mode: string }) {
  const app = await db.query.apps.findFirst({ where: eq(apps.id, license.appId) });
  return Boolean(app && app.mode === license.mode);
}
