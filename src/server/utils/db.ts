import { eq } from "drizzle-orm";
import { apps, builders, transactions, licenses } from "../db/schema";

export async function getAppOr404(db: any, id: string) {
  const app = await db.query.apps.findFirst({ where: eq(apps.id, id) });
  if (!app) return null;
  return app;
}

export async function getTransactionOr404(db: any, id: string) {
  const tx = await db.query.transactions.findFirst({ where: eq(transactions.id, id) });
  if (!tx) return null;
  return tx;
}

export async function getBuilderById(db: any, id: string) {
  const builder = await db.query.builders.findFirst({ where: eq(builders.id, id) });
  if (!builder) return null;
  return builder;
}

export async function getLicenseByKey(db: any, key: string) {
  const license = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, key.trim()),
  });
  if (!license) return null;
  return license;
}
