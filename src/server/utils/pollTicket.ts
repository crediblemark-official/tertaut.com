import { createHmac, timingSafeEqual } from "crypto";
import { config } from "../config";

/**
 * Poll ticket: bukti kepemilikan transaksi untuk endpoint status publik.
 *
 * Latar belakang (BUG-5): `/checkout/status/:txId` membeberkan licenseKey + amount
 * kepada siapa pun yang mengetahui txId. txId adalah bearer secret, tapi bisa bocor
 * lewat URL/log/referrer. Ticket HMAC ini membatasi pengungkapan licenseKey hanya
 * kepada pemanggil yang sah (yang menerimanya dari respons create-session atau dari
 * redirect finish yang dibangun server).
 */
const TICKET_TTL_MS = 45 * 60 * 1000; // sesi polling pembayaran maksimal ~30 menit

export function createPollTicket(txId: string): string {
  const expires = Date.now() + TICKET_TTL_MS;
  const payload = `${txId}.${expires}`;
  const sig = createHmac("sha256", config.security.jwtSecret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyPollTicket(txId: string, ticket: string | null | undefined): boolean {
  if (!ticket || typeof ticket !== "string") return false;
  const parts = ticket.split(".");
  if (parts.length !== 3) return false;
  const [id, exp, sig] = parts;
  if (id !== txId) return false;
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;

  const expected = createHmac("sha256", config.security.jwtSecret).update(`${id}.${exp}`).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sig, "hex");
  } catch {
    return false;
  }
  return provided.length === expected.length && timingSafeEqual(expected, provided);
}