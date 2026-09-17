import { Elysia, t } from "elysia";
import { db } from "../db";
import { licenses, licenseActivations, apps, transactions } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { CryptoService } from "../services/crypto";
import { enforceRateLimit } from "../services/rateLimiter";

const PORTAL_TOKEN_TTL_SECONDS = 3600;

/** Ambil portal access token dari query `token` atau header Authorization Bearer. */
function extractPortalToken(query: any, headers: any): string | null {
  const fromQuery = typeof query?.token === "string" ? query.token : null;
  if (fromQuery) return fromQuery;
  const auth = headers?.authorization || headers?.Authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return null;
}

/** Verifikasi portal token & kembalikan email pemilik yang tervalidasi (atau null). */
function resolvePortalEmail({ query, request }: any): string | null {
  const token = extractPortalToken(query, request?.headers);
  if (!token) return null;
  const payload = CryptoService.verifySignedToken<{ typ?: string; email?: string }>(token);
  if (!payload || payload.typ !== "portal" || !payload.email) return null;
  return String(payload.email).trim().toLowerCase();
}

export const portalRoutes = new Elysia({ prefix: "/portal" })
  /**
   * Menukar bukti kepemilikan (email + salah satu license key miliknya)
   * menjadi portal access token berumur pendek.
   */
  .post(
    "/access",
    async ({ body, set, request }) => {
      const email = body.email.trim().toLowerCase();
      const licenseKey = body.licenseKey.trim();

      const rl = enforceRateLimit(request, "portal:access", 10, 60_000);
      if (!rl.allowed) {
        set.status = 429;
        return { success: false, error: `Terlalu banyak percobaan. Coba lagi dalam ${rl.retryAfter} detik.` };
      }

      const lic = await db.query.licenses.findFirst({
        where: eq(licenses.licenseKey, licenseKey),
      });

      if (!lic || lic.customerEmail.trim().toLowerCase() !== email) {
        set.status = 403;
        return { success: false, error: "Email tidak cocok dengan pemilik license key tersebut" };
      }

      const token = CryptoService.createSignedToken(
        { typ: "portal", email },
        PORTAL_TOKEN_TTL_SECONDS
      );

      return { success: true, token, expiresInSeconds: PORTAL_TOKEN_TTL_SECONDS };
    },
    {
      body: t.Object({
        email: t.String(),
        licenseKey: t.String(),
      }),
      detail: {
        tags: ["Customer Portal"],
        summary: "Exchange Email + License Key for Portal Access Token",
      },
    }
  )

  /**
   * Mengambil semua lisensi milik pembeli (wajib portal access token)
   */
  .get(
    "/licenses",
    async ({ query, request, set }) => {
      const email = resolvePortalEmail({ query, request });
      if (!email) {
        set.status = 401;
        return {
          success: false,
          error: "Portal access token tidak valid. Masukkan email + salah satu license key Anda.",
        };
      }

      const rl = enforceRateLimit(request, "portal:licenses", 60, 60_000);
      if (!rl.allowed) {
        set.status = 429;
        return { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${rl.retryAfter} detik.` };
      }

      const buyerLicenses = await db.query.licenses.findMany({
        where: eq(licenses.customerEmail, email),
        orderBy: (l, { desc }) => [desc(l.createdAt)],
      });

      // Enrich dengan detail aplikasi dan device activations
      const enriched = await Promise.all(
        buyerLicenses.map(async (lic) => {
          const app = await db.query.apps.findFirst({
            where: eq(apps.id, lic.appId),
          });

          const activations = await db.query.licenseActivations.findMany({
            where: eq(licenseActivations.licenseId, lic.id),
            orderBy: (a, { desc }) => [desc(a.lastValidatedAt)],
          });

          return {
            id: lic.id,
            licenseKey: lic.licenseKey,
            appId: lic.appId,
            appName: app?.name || lic.appId,
            appSlug: app?.slug || lic.appId,
            platform: lic.platform,
            status: lic.status,
            maxSeats: lic.maxSeats,
            seatsUsed: activations.length,
            hardwareId: lic.hardwareId,
            expiresAt: lic.expiresAt,
            issuedAt: lic.createdAt,
            offlineJwtGraceToken: lic.offlineJwtGraceToken,
            activations: activations.map((act) => ({
              id: act.id,
              deviceName: act.deviceName || "Desktop / Device",
              hwidHash: act.hwidHash,
              lastValidatedAt: act.lastValidatedAt,
              createdAt: act.createdAt,
            })),
          };
        })
      );

      return {
        success: true,
        email,
        count: enriched.length,
        totalLicenses: enriched.length,
        licenses: enriched,
      };
    },
    {
      query: t.Object({
        token: t.Optional(t.String()),
        email: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Customer Portal"],
        summary: "Get Buyer Licenses",
        description: "Retrieve all purchased licenses and active device seats for the token owner",
      },
    }
  )

  /**
   * Self-Service Seat Deactivation (Pembeli mencopot seat perangkat lama sendiri)
   */
  .post(
    "/deactivate-device",
    async ({ body, set, request }) => {
      const { licenseKey, hwidHash, customerEmail } = body;

      const rl = enforceRateLimit(request, "portal:deactivate", 20, 60_000);
      if (!rl.allowed) {
        set.status = 429;
        return { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${rl.retryAfter} detik.` };
      }

      const lic = await db.query.licenses.findFirst({
        where: eq(licenses.licenseKey, licenseKey),
      });

      if (!lic) {
        set.status = 404;
        return { success: false, error: "Kunci lisensi tidak ditemukan" };
      }

      // Wajib buktikan kepemilikan: email harus cocok dengan pemilik lisensi
      if (lic.customerEmail.toLowerCase() !== customerEmail.trim().toLowerCase()) {
        set.status = 403;
        return { success: false, error: "Email tidak cocok dengan pemilik lisensi" };
      }

      const activation = await db.query.licenseActivations.findFirst({
        where: and(
          eq(licenseActivations.licenseId, lic.id),
          eq(licenseActivations.hwidHash, hwidHash)
        ),
      });

      if (!activation) {
        set.status = 404;
        return { success: false, error: "Perangkat dengan HWID tersebut tidak ditemukan pada lisensi ini" };
      }

      await db
        .delete(licenseActivations)
        .where(eq(licenseActivations.id, activation.id));

      const remainingActivations = await db.query.licenseActivations.findMany({
        where: eq(licenseActivations.licenseId, lic.id),
      });

      return {
        success: true,
        message: "Perangkat berhasil dilepas dari kuota lisensi.",
        remainingSeatsUsed: remainingActivations.length,
        remainingSeats: lic.maxSeats - remainingActivations.length,
        maxSeats: lic.maxSeats,
      };
    },
    {
      body: t.Object({
        licenseKey: t.String(),
        hwidHash: t.String(),
        customerEmail: t.String(),
      }),
      detail: {
        tags: ["Customer Portal"],
        summary: "Self-Service Deactivate Device",
        description: "Allows a buyer to release a device seat from their license",
      },
    }
  )

  /**
   * Mengambil riwayat transaksi dan invoice pembelian milik pembeli
   */
  .get(
    "/transactions",
    async ({ query, request, set }) => {
      const email = resolvePortalEmail({ query, request });
      if (!email) {
        set.status = 401;
        return {
          success: false,
          error: "Portal access token tidak valid. Masukkan email + salah satu license key Anda.",
        };
      }

      const rl = enforceRateLimit(request, "portal:transactions", 60, 60_000);
      if (!rl.allowed) {
        set.status = 429;
        return { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${rl.retryAfter} detik.` };
      }

      const buyerTxs = await db.query.transactions.findMany({
        where: eq(transactions.customerEmail, email),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      });

      const enrichedTxs = await Promise.all(
        buyerTxs.map(async (tx) => {
          const app = await db.query.apps.findFirst({
            where: eq(apps.id, tx.appId),
          });
          return {
            id: tx.id,
            appId: tx.appId,
            appName: app?.name || tx.appId,
            grossAmount: tx.grossAmount,
            paymentChannel: tx.paymentChannel || "Xendit",
            paymentStatus: tx.paymentStatus,
            invoiceUrl: tx.xenditInvoiceUrl,
            paidAt: tx.paidAt,
            createdAt: tx.createdAt,
          };
        })
      );

      return {
        success: true,
        email,
        count: enrichedTxs.length,
        totalTransactions: enrichedTxs.length,
        transactions: enrichedTxs,
      };
    },
    {
      query: t.Object({
        token: t.Optional(t.String()),
        email: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Customer Portal"],
        summary: "Get Buyer Purchase History",
        description: "Retrieve all purchase receipts and transactions for the token owner",
      },
    }
  );
