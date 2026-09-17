import { db } from "../../db";
import { licenses, licenseActivations } from "../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { LicenseService } from "../../services/license";
import { CreditService } from "../../services/credits";
import { enforceRateLimit } from "../../services/rateLimiter";

export type LicenseAuthResult =
  | { ok: true; license: any }
  | { ok: false; status: number; reason: string; message: string };

/**
 * Bukti kepemilikan untuk endpoint kredit: lisensi harus ACTIVE & belum kedaluwarsa.
 * Bila `requireHwid` (operasi mutasi), perangkat harus sudah teraktivasi.
 */
export async function authorizeLicense(
  licenseKey: string,
  hwid: string | undefined,
  requireHwid: boolean
): Promise<LicenseAuthResult> {
  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    return { ok: false, status: 404, reason: "LICENSE_NOT_FOUND", message: "License key not found" };
  }

  if (lic.status !== "ACTIVE") {
    return { ok: false, status: 403, reason: `LICENSE_${lic.status}`, message: `License is ${lic.status}` };
  }

  const now = new Date();
  if (lic.expiresAt && lic.expiresAt < now) {
    await db
      .update(licenses)
      .set({ status: "EXPIRED", updatedAt: now })
      .where(eq(licenses.id, lic.id));
    return { ok: false, status: 403, reason: "LICENSE_EXPIRED", message: "License has expired" };
  }

  if (requireHwid || hwid) {
    if (!hwid) {
      return { ok: false, status: 400, reason: "HWID_REQUIRED", message: "hwid wajib untuk operasi ini" };
    }
    const lookupHashes = LicenseService.hwidLookupHashes(hwid);
    const activation = await db.query.licenseActivations.findFirst({
      where: and(
        eq(licenseActivations.licenseId, lic.id),
        inArray(licenseActivations.hwidHash, lookupHashes)
      ),
    });
    const mainBound = lic.hardwareId ? lookupHashes.includes(lic.hardwareId) : false;
    if (!activation && !mainBound) {
      return {
        ok: false,
        status: 403,
        reason: "DEVICE_NOT_ACTIVATED",
        message: "Perangkat ini belum teraktivasi untuk lisensi ini.",
      };
    }
  }

  return { ok: true, license: lic };
}

export async function handleCreditBalance({ body, set, request }: any) {
  const { licenseKey, hwid } = body;

  const rl = enforceRateLimit(request, "licensing:credits:balance", 120, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { success: false, reason: "RATE_LIMITED" };
  }

  const auth = await authorizeLicense(licenseKey, hwid, false);
  if (!auth.ok) {
    set.status = auth.status;
    return { success: false, reason: auth.reason, message: auth.message };
  }

  const balance = await CreditService.getBalance(auth.license.id);
  return { success: true, licenseKey: auth.license.licenseKey, balance };
}

export async function handleConsumeCredits({ body, set, request }: any) {
  const { licenseKey, hwid, amount, reason, reference } = body;

  const rl = enforceRateLimit(request, "licensing:credits:consume", 120, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { success: false, reason: "RATE_LIMITED" };
  }

  const auth = await authorizeLicense(licenseKey, hwid, true);
  if (!auth.ok) {
    set.status = auth.status;
    return { success: false, reason: auth.reason, message: auth.message };
  }

  const result = await CreditService.debit(
    {
      licenseId: auth.license.id,
      appId: auth.license.appId,
      customerEmail: auth.license.customerEmail,
    },
    amount,
    {
      reference: reference ?? null,
      description: reason ?? "Pemakaian kredit oleh aplikasi",
    }
  );

  if (!result.ok) {
    set.status = result.reason === "INSUFFICIENT_CREDITS" ? 402 : 404;
    return { success: false, reason: result.reason, balance: result.balance };
  }

  return { success: true, balance: result.balance, consumed: result.consumed };
}

export async function handleCreditHistory({ body, set, request }: any) {
  const { licenseKey, hwid, limit } = body;

  const rl = enforceRateLimit(request, "licensing:credits:history", 60, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { success: false, reason: "RATE_LIMITED" };
  }

  const auth = await authorizeLicense(licenseKey, hwid, false);
  if (!auth.ok) {
    set.status = auth.status;
    return { success: false, reason: auth.reason, message: auth.message };
  }

  const [balance, entries] = await Promise.all([
    CreditService.getBalance(auth.license.id),
    CreditService.history(auth.license.id, limit ?? 50),
  ]);

  return { success: true, balance, entries };
}
