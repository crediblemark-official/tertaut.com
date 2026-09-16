import { Elysia, t } from "elysia";
import { db } from "../db";
import { apps, transactions, licenses, builders } from "../db/schema";
import { eq } from "drizzle-orm";
import { XenditService } from "../services/xendit";
import { LicenseService } from "../services/license";
import { config as checkoutConfig } from "../config";
import { randomBytes } from "crypto";
import { handleXenditInvoiceWebhook, webhookSchema } from "./webhook";

/** Harga default dipakai hanya kalau aplikasi belum menetapkan target_price. */
const DEFAULT_PRICE = checkoutConfig.defaultPrice;

const formatIdr = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(value);

export const checkoutRoutes = new Elysia({ prefix: "/checkout" })
  /**
   * PRD 7.1 B: Webhook Xendit Invoice Callback
   */
  .post(
    "/webhook/xendit",
    handleXenditInvoiceWebhook,
    webhookSchema
  )
  /**
   * Pemicu Dynamic & Headless Checkout Link
   */
  .post(
    "/session",
    async ({ body, set }) => {
      const {
        appId,
        appSlug,
        slug,
        amount,
        customAmount,
        customerEmail,
        buyerEmail,
        grantDays = 365,
        grantCredits = 0,
        redirectUrl,
      } = body;

      const targetIdentifier = appId || appSlug || slug;
      if (!targetIdentifier) {
        set.status = 400;
        return { error: "appId atau appSlug wajib disertakan" };
      }

      // Cari aplikasi berdasarkan ID atau Slug
      let app = await db.query.apps.findFirst({
        where: eq(apps.id, targetIdentifier),
      });

      if (!app) {
        app = await db.query.apps.findFirst({
          where: eq(apps.slug, targetIdentifier),
        });
      }

      if (!app) {
        set.status = 404;
        return { error: `Produk / Aplikasi "${targetIdentifier}" tidak ditemukan` };
      }

      const email = (buyerEmail || customerEmail || "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        set.status = 400;
        return { error: "Email pembeli tidak valid" };
      }

      // Harga adalah otoritas server, bukan klien. Pembeli hanya boleh membayar
      // sesuai harga resmi aplikasi atau lebih (mis. donasi/upgrade) — tidak pernah kurang.
      const appPrice = app.targetPrice ?? 0;
      const requestedAmount = customAmount ?? amount ?? null;

      if (appPrice > 0 && requestedAmount !== null && requestedAmount < appPrice) {
        set.status = 400;
        return {
          error: `Nominal pembayaran tidak valid. Harga resmi "${app.name}" adalah ${formatIdr(appPrice)}.`,
        };
      }

      const txAmount =
        appPrice > 0
          ? Math.max(requestedAmount ?? appPrice, appPrice)
          : (requestedAmount ?? DEFAULT_PRICE);

      // Hitung Merchant of Record 5% platform fee & 95% net
      const { grossAmount, platformFee, netAmount } = XenditService.calculateMorBreakdown(txAmount);

      const txId = `tx_${randomBytes(8).toString("hex")}`;
      const externalId = `tt_${app.id}_${Date.now()}`;

      // Buat Invoice via Xendit
      const xenditInvoice = await XenditService.createInvoice({
        externalId,
        amount: grossAmount,
        payerEmail: email,
        description: `Lisensi ${app.name} (${grantDays} hari)`,
        successRedirectUrl: redirectUrl || app.redirectUrl || undefined,
        failureRedirectUrl: redirectUrl || app.redirectUrl || undefined,
      });

      // Simpan transaksi di database
      const [newTx] = await db
        .insert(transactions)
        .values({
          id: txId,
          appId: app.id,
          builderId: app.builderId,
          xenditInvoiceId: xenditInvoice.id,
          xenditExternalId: externalId,
          xenditInvoiceUrl: xenditInvoice.invoice_url,
          customerEmail: email,
          grossAmount,
          platformFee,
          netAmount,
          paymentStatus: "PENDING",
          disbursementStatus: "PENDING",
          grantDays,
          grantCredits,
        })
        .returning();

      return {
        success: true,
        data: {
          sessionId: newTx.id,
          xenditInvoiceUrl: xenditInvoice.invoice_url,
          expiresAt: xenditInvoice.expiry_date || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
        transactionId: newTx.id,
        checkoutUrl: xenditInvoice.invoice_url,
        amount: grossAmount,
        platformFee,
        netDisbursementAmount: netAmount,
      };
    },
    {
      body: t.Object({
        appId: t.Optional(t.String()),
        appSlug: t.Optional(t.String()),
        slug: t.Optional(t.String()),
        amount: t.Optional(t.Number({ minimum: 1000 })),
        customAmount: t.Optional(t.Number({ minimum: 1000 })),
        customerEmail: t.Optional(t.String()),
        buyerEmail: t.Optional(t.String()),
        grantDays: t.Optional(t.Number({ default: 365 })),
        grantCredits: t.Optional(t.Number({ default: 0 })),
        redirectUrl: t.Optional(t.String()),
      }),
      detail: {
        tags: ["MoR Checkout"],
        summary: "Create Dynamic Checkout Session",
        description: "Creates a dynamic Xendit invoice session with 5% MoR platform fee auto-deducted",
      },
    }
  )

  /**
   * Daftar riwayat transaksi MoR
   */
  .get(
    "/transactions",
    async ({ query }) => {
      const { appId, limit = 50 } = query;
      let txs;
      if (appId) {
        txs = await db.query.transactions.findMany({
          where: eq(transactions.appId, appId),
          orderBy: (tx, { desc }) => [desc(tx.createdAt)],
          limit: Number(limit),
        });
      } else {
        txs = await db.query.transactions.findMany({
          orderBy: (tx, { desc }) => [desc(tx.createdAt)],
          limit: Number(limit),
        });
      }

      return {
        success: true,
        transactions: txs,
      };
    },
    {
      query: t.Object({
        appId: t.Optional(t.String()),
        limit: t.Optional(t.Numeric({ default: 50 })),
      }),
      detail: {
        tags: ["MoR Checkout"],
        summary: "List MoR Transactions",
      },
    }
  )

  /**
   * Trigger pencairan saldo (Xendit Disbursement) manual / instant payout
   */
  .post(
    "/disburse/:txId",
    async ({ params: { txId }, set }) => {
      const tx = await db.query.transactions.findFirst({
        where: eq(transactions.id, txId),
      });

      if (!tx) {
        set.status = 404;
        return { error: "Transaction not found" };
      }

      if (tx.paymentStatus !== "PAID") {
        set.status = 400;
        return { error: "Hanya transaksi yang sudah lunas (PAID) yang dapat dicairkan." };
      }

      if (tx.disbursementStatus === "COMPLETED") {
        return { success: true, message: "Pencairan dana sudah pernah diproses.", disbursementId: tx.disbursementId };
      }

      const externalDisbId = `disb_${tx.id}_${Date.now()}`;
      try {
        // Cari rekening penerima dari profil builder transaksi
        const builder = await db.query.builders.findFirst({
          where: eq(builders.id, tx.builderId),
        });

        const recipient = XenditService.resolveDisbursementAccount(builder);

        // Production TANPA rekening tersimpan → tolak pencairan (jangan pakai data palsu)
        if (!recipient) {
          set.status = 400;
          return {
            error:
              "Builder belum menyimpan rekening penerima disbursement. Lengkapi profil bank/e-wallet terlebih dahulu.",
          };
        }

        const disbRes = await XenditService.createDisbursement({
          externalId: externalDisbId,
          amount: tx.netAmount,
          ...recipient,
          description: `Pencairan Saldo Bersih 95% tertaut.com ${tx.id}`,
        });

        // Kejujuran status: COMPLETED hanya kalau Xendit benar-benar menyelesaikannya.
        const finalStatus =
          disbRes.status === "COMPLETED"
            ? "COMPLETED"
            : disbRes.status === "FAILED"
              ? "FAILED"
              : "PROCESSING";

        await db
          .update(transactions)
          .set({
            disbursementStatus: finalStatus,
            disbursementId: disbRes.id,
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, tx.id));

        return {
          success: true,
          message:
            finalStatus === "COMPLETED"
              ? "Pencairan berhasil dipicu ke rekening builder via Xendit API."
              : "Pencairan terkirim ke Xendit dan masih berstatus PROCESSING.",
          disbursement: { ...disbRes, status: finalStatus },
        };
      } catch (err: any) {
        set.status = 500;
        return { error: err.message || "Gagal memproses pencairan Xendit." };
      }
    },
    {
      params: t.Object({
        txId: t.String(),
      }),
      detail: {
        tags: ["MoR Checkout"],
        summary: "Trigger Xendit Disbursement",
      },
    }
  )

  /**
   * One-Click Local Payment Simulator for Developers (Hanya Sandbox)
   */
  .post(
    "/simulate-paid/:txId",
    async ({ params: { txId }, set }) => {
      if (!checkoutConfig.isSandbox) {
        set.status = 403;
        return { error: "Simulate paid hanya tersedia di mode sandbox." };
      }

      const tx = await db.query.transactions.findFirst({
        where: eq(transactions.id, txId),
      });

      if (!tx) {
        set.status = 404;
        return { error: "Transaksi tidak ditemukan" };
      }

      if (tx.paymentStatus === "PAID") {
        const existingLic = await db.query.licenses.findFirst({
          where: eq(licenses.transactionId, tx.id),
        });
        return {
          success: true,
          message: "Transaksi sudah berstatus PAID sebelumnya.",
          licenseKey: existingLic?.licenseKey,
        };
      }

      // Generate and provision universal license
      const licenseKey = LicenseService.generateLicenseKey();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (tx.grantDays || 365));

      const licId = `lic_${randomBytes(8).toString("hex")}`;
      const [newLic] = await db
        .insert(licenses)
        .values({
          id: licId,
          appId: tx.appId,
          transactionId: tx.id,
          licenseKey,
          customerEmail: tx.customerEmail,
          status: "ACTIVE",
          maxSeats: 3,
          platform: "general",
          expiresAt,
        })
        .returning();

      await db
        .update(transactions)
        .set({
          paymentStatus: "PAID",
          paymentChannel: "SIMULATOR_QRIS",
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, tx.id));

      return {
        success: true,
        message: "Simulasi pembayaran sukses! Lisensi diterbitkan.",
        transactionId: tx.id,
        licenseKey: newLic.licenseKey,
      };
    },
    {
      params: t.Object({
        txId: t.String(),
      }),
      detail: {
        tags: ["MoR Checkout"],
        summary: "Simulate Successful Payment (Local Developer Sandbox)",
      },
    }
  );
