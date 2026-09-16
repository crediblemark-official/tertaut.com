import { Elysia, t } from "elysia";
import { db } from "../db";
import { licenses, licenseActivations, apps, transactions } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

export const portalRoutes = new Elysia({ prefix: "/portal" })
  /**
   * Mengambil semua lisensi milik pembeli berdasarkan email
   */
  .get(
    "/licenses",
    async ({ query, set }) => {
      const email = (query.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        set.status = 400;
        return { success: false, error: "Email pembeli tidak valid" };
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
        email: t.String(),
      }),
      detail: {
        tags: ["Customer Portal"],
        summary: "Get Buyer Licenses",
        description: "Retrieve all purchased licenses and active device seats by buyer email",
      },
    }
  )

  /**
   * Self-Service Seat Deactivation (Pembeli mencopot seat perangkat lama sendiri)
   */
  .post(
    "/deactivate-device",
    async ({ body, set }) => {
      const { licenseKey, hwidHash, customerEmail } = body;

      const lic = await db.query.licenses.findFirst({
        where: eq(licenses.licenseKey, licenseKey),
      });

      if (!lic) {
        set.status = 404;
        return { success: false, error: "Kunci lisensi tidak ditemukan" };
      }

      // Verifikasi kepemilikan jika customerEmail disertakan
      if (customerEmail && lic.customerEmail.toLowerCase() !== customerEmail.trim().toLowerCase()) {
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
        customerEmail: t.Optional(t.String()),
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
    async ({ query, set }) => {
      const email = (query.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        set.status = 400;
        return { success: false, error: "Email pembeli tidak valid" };
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
        email: t.String(),
      }),
      detail: {
        tags: ["Customer Portal"],
        summary: "Get Buyer Purchase History",
        description: "Retrieve all purchase receipts and transactions for a buyer email",
      },
    }
  );
