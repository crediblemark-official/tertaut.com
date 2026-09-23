import { CreditService } from "../../services/credits";
import { ownedLicense } from "./helpers";

/**
 * Cek saldo kredit lisensi milik builder
 */
export async function handleS2SCreditBalance({ builder, query, set }: any) {
  const owned = await ownedLicense(builder, query.licenseKey);
  if (!owned) {
    set.status = 404;
    return { error: "Licensi tidak ditemukan atau bukan milik builder" };
  }
  const balance = await CreditService.getBalance(owned.lic.id);
  return { success: true, licenseKey: owned.lic.licenseKey, balance };
}

/**
 * Konsumsi kredit lisensi milik builder (metering server-to-server, idempoten via reference)
 */
export async function handleS2SCreditConsume({ builder, body, set }: any) {
  const owned = await ownedLicense(builder, body.licenseKey);
  if (!owned) {
    set.status = 404;
    return { error: "Licensi tidak ditemukan atau bukan milik builder" };
  }

  const result = await CreditService.debit(
    {
      licenseId: owned.lic.id,
      appId: owned.app.id,
      customerEmail: owned.lic.customerEmail,
    },
    body.amount,
    {
      description: body.reason || "Credit consumed via S2S",
      reference: body.reference,
    }
  );

  if (!result.ok) {
    set.status = result.reason === "LICENSE_NOT_FOUND" ? 404 : 409;
    return { success: false, reason: result.reason, balance: result.balance };
  }

  return { success: true, balance: result.balance, consumed: result.consumed };
}
