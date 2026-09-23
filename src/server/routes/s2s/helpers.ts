import { db } from "../../db";
import { apps, licenses } from "../../db/schema";
import { eq } from "drizzle-orm";
import type { Builder } from "../../db/schema/builders";

export async function ownedLicense(builder: Builder, licenseKey: string) {
  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });
  if (!lic) return null;
  const app = await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
  if (!app || app.builderId !== builder.id) return null;
  return { lic, app };
}

export async function ownedApp(builder: Builder, appId: string) {
  const app = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
  if (!app || app.builderId !== builder.id) return null;
  return app;
}
