import { Elysia, t } from "elysia";
import { db } from "../db";
import { apps, transactions, licenses, builders } from "../db/schema";
import { eq, inArray, or } from "drizzle-orm";
import { XenditService } from "../services/xendit";
import { DanaService } from "../services/dana";
import { LicenseService } from "../services/license";
import { CouponService } from "../services/coupon";
import { config as checkoutConfig } from "../config";
import { randomBytes } from "crypto";
import {
  handleXenditInvoiceWebhook,
  webhookSchema,
  handleDanaFinishPaymentWebhook,
  danaWebhookSchema,
  fulfillPaymentTransaction,
} from "./webhook";
import { authenticate } from "../middleware/auth";

/** Harga default dipakai hanya kalau aplikasi belum menetapkan target_price. */
const DEFAULT_PRICE = checkoutConfig.defaultPrice;

const formatIdr = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(value);

/** Endpoint checkout yang memang harus publik (webhook, buat sesi, preview kupon, redirect DANA). */
const PUBLIC_CHECKOUT_PATHS = ["webhook", "/session", "preview-coupon", "dana/finish"];

export const checkoutRoutes = new Elysia({ prefix: "/checkout" })
  // Dashboard-only: /transactions, /disburse/:txId, /simulate-paid/:txId
  .onBeforeHandle(async ({ request: { headers }, status, path }) => {
    if (PUBLIC_CHECKOUT_PATHS.some((p) => path.includes(p))) return;
    const res = await authenticate(headers);
    if ("status" in res) return status(res.status, { error: res.error });
  })
  /**
   * PRD 7.1 B: Webhook Xendit Invoice Callback
   */
  .post(
    "/webhook/xendit",
    handleXenditInvoiceWebhook,
    webhookSchema
  )
  /**
   * Webhook DANA Finish Payment Callback
   */
  .post(
    "/webhook/dana",
    handleDanaFinishPaymentWebhook,
    danaWebhookSchema
  )
  .post(
    "/webhook/dana/finish-payment",
    handleDanaFinishPaymentWebhook,
    danaWebhookSchema
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
        // TODO(grantCredits): hanya disimpan, belum ditegakkan (tak ada ledger kredit).
        grantCredits = 0,
        redirectUrl,
        couponCode,
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

      const isSandboxApp = app.mode === "sandbox";

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

      // Harga list yang jadi basis diskon (sebelum kupon). Client boleh menawar
      // lebih dari harga resmi, diskon dihitung dari harga resmi, bukan dari
      // nominal yang diminta client agar tidak bisa dipakai untuk menurunkan
      // harga semena-mena.
      const listPrice = txAmount;

      // 1. Validasi & hitung diskon kupon (jika ada)
      let coupon: Awaited<ReturnType<typeof CouponService.validate>>["coupon"] = undefined;
      let discountAmount = 0;
      let discountPercent = 0;
      if (couponCode) {
        const couponResult = await CouponService.validate(couponCode, app.id, listPrice);
        if (!couponResult.valid) {
          set.status = 400;
          return {
            error: couponResult.message || "Kupon tidak valid.",
            errorCode: couponResult.errorCode,
          };
        }
        coupon = couponResult.coupon;
        discountAmount = couponResult.discountAmount || 0;
        discountPercent = couponResult.discountPercent || 0;
      }

      // 2. Nominal yang benar-benar dibayar setelah diskon
      const payableAmount = Math.max(0, listPrice - discountAmount);
      if (payableAmount <= 0) {
        set.status = 400;
        return {
          error: `Diskon kupon ${discountPercent}% membuat total pembayaran menjadi nol. Gunakan kupon dengan diskon lebih rendah atau hubungi developer aplikasi.`,
        };
      }

      // Tentukan payment gateway yang aktif (override per request > default config)
      const selectedGateway: "xendit" | "dana" =
        (body.paymentGateway?.toLowerCase() === "dana" ||
          (!body.paymentGateway && checkoutConfig.paymentGateway === "dana"))
          ? "dana"
          : "xendit";

      // Hitung Merchant of Record 5% platform fee & 95% net atas nominal yang dibayar
      const { grossAmount, platformFee, netAmount } =
        selectedGateway === "dana"
          ? DanaService.calculateMorBreakdown(payableAmount)
          : XenditService.calculateMorBreakdown(payableAmount);

      const txId = `tx_${randomBytes(8).toString("hex")}`;
      const externalId = `tt_${app.id}_${Date.now()}`;

      let invoiceUrl = "";
      let invoiceId = "";
      let expiryDate = "";

      if (selectedGateway === "dana") {
        const danaOrder = await DanaService.createOrder({
          externalId,
          amount: grossAmount,
          payerEmail: email,
          description: `Lisensi ${app.name} (${grantDays} hari)`,
          returnUrl: redirectUrl || app.redirectUrl || undefined,
          finishRedirectUrl: `${checkoutConfig.publicAppUrl}/checkout/dana/finish?externalId=${externalId}`,
          forceMock: isSandboxApp,
        });
        invoiceUrl = danaOrder.checkoutUrl;
        invoiceId = danaOrder.orderId;
        expiryDate = danaOrder.expiryDate;
      } else {
        const xenditInvoice = await XenditService.createInvoice({
          externalId,
          amount: grossAmount,
          payerEmail: email,
          description: `Lisensi ${app.name} (${grantDays} hari)`,
          successRedirectUrl: redirectUrl || app.redirectUrl || undefined,
          failureRedirectUrl: redirectUrl || app.redirectUrl || undefined,
          forceMock: isSandboxApp,
        });
        invoiceUrl = xenditInvoice.invoice_url;
        invoiceId = xenditInvoice.id;
        expiryDate = xenditInvoice.expiry_date;
      }

      // Simpan transaksi di database
      const [newTx] = await db
        .insert(transactions)
        .values({
          id: txId,
          appId: app.id,
          builderId: app.builderId,
          paymentProvider: selectedGateway,
          providerReferenceId: invoiceId,
          xenditInvoiceId: invoiceId,
          xenditExternalId: externalId,
          xenditInvoiceUrl: invoiceUrl,
          customerEmail: email,
          grossAmount,
          platformFee,
          netAmount,
          couponCode: coupon?.code || null,
          discountAmount,
          paymentStatus: "PENDING",
          disbursementStatus: "PENDING",
          grantDays,
          grantCredits,
        })
        .returning();

      // 3. Klaim kuota kupon ATOMIK hanya setelah transaksi tercatat.
      // Jika kehabisan kuota di sini (race), hapus transaksi tadi dan gagalkan
      // checkout — jangan sampai invoice terdiskon beredar tanpa kuota kupon.
      if (coupon) {
        const redeemed = await CouponService.redeem(coupon.id);
        if (!redeemed) {
          await db.delete(transactions).where(eq(transactions.id, newTx.id));
          set.status = 409;
          return {
            success: false,
            error: "Kuota kupon baru saja habis. Transaksi tidak dibuat.",
            errorCode: "COUPON_EXHAUSTED",
          };
        }
      }

      return {
        success: true,
        data: {
          sessionId: newTx.id,
          paymentGateway: selectedGateway,
          checkoutUrl: invoiceUrl,
          xenditInvoiceUrl: invoiceUrl,
          expiresAt: expiryDate || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          isSandbox: isSandboxApp,
        },
        transactionId: newTx.id,
        checkoutUrl: invoiceUrl,
        paymentGateway: selectedGateway,
        amount: grossAmount,
        listPrice,
        discountAmount,
        discountPercent,
        couponCode: coupon?.code || null,
        platformFee,
        netDisbursementAmount: netAmount,
      };
    },
    {
      body: t.Object({
        appId: t.Optional(t.String()),
        appSlug: t.Optional(t.String()),
        slug: t.Optional(t.String()),
        paymentGateway: t.Optional(t.String()),
        amount: t.Optional(t.Number({ minimum: 1000 })),
        customAmount: t.Optional(t.Number({ minimum: 1000 })),
        customerEmail: t.Optional(t.String()),
        buyerEmail: t.Optional(t.String()),
        grantDays: t.Optional(t.Number({ default: 365 })),
        // TODO(grantCredits): inert — hanya disimpan, belum ada ledger/saldo kredit.
        grantCredits: t.Optional(t.Number({ default: 0 })),
        redirectUrl: t.Optional(t.String()),
        couponCode: t.Optional(t.String({ maxLength: 64 })),
      }),
      detail: {
        tags: ["MoR Checkout"],
        summary: "Create Dynamic Checkout Session",
        description: "Creates a dynamic invoice session (Xendit / DANA) with 5% MoR platform fee auto-deducted",
      },
    }
  )
  /**
   * Endpoint Redirect pembeli setelah menyelesaikan pembayaran DANA (Finish Redirect URL)
   */
  .get(
    "/dana/finish",
    async ({ query, set }) => {
      const { orderId, externalId, mock } = query as {
        orderId?: string;
        externalId?: string;
        mock?: string;
      };

      const identifier = externalId || orderId;
      if (!identifier) {
        return { message: "Pembayaran DANA selesai. Silakan cek portal Anda untuk lisensi." };
      }

      const tx = await db.query.transactions.findFirst({
        where: or(
          eq(transactions.xenditExternalId, identifier),
          eq(transactions.providerReferenceId, identifier),
          eq(transactions.id, identifier)
        ),
      });

      if (!tx) {
        return { message: "Transaksi tidak ditemukan." };
      }

      const app = await db.query.apps.findFirst({
        where: eq(apps.id, tx.appId),
      });

      // Jika mock mode pada sandbox browser test, simulasi auto-paid
      if (mock === "true" && tx.paymentStatus === "PENDING") {
        await fulfillPaymentTransaction(tx, "DANA_MOCK");
      }

      const targetUrl =
        app?.redirectUrl ||
        `${checkoutConfig.publicAppUrl}/portal?email=${encodeURIComponent(tx.customerEmail)}`;

      set.redirect = targetUrl;
    }
  )

  /**
   * Preview kupon tanpa membuat transaksi (dipakai halaman /pay/:slug)
   */
  .post(
    "/preview-coupon",
    async ({ body, set }) => {
      const { appId, couponCode, amount } = body;

      const app = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
      if (!app) {
        set.status = 404;
        return { valid: false, message: "Produk tidak ditemukan" };
      }

      const listPrice = amount ?? app.targetPrice ?? 0;
      const result = await CouponService.validate(couponCode, app.id, listPrice);
      if (!result.valid) {
        set.status = 400;
        return { valid: false, message: result.message, errorCode: result.errorCode };
      }

      return {
        valid: true,
        coupon: { code: result.coupon!.code, discountPercent: result.discountPercent },
        discountPercent: result.discountPercent,
        discountAmount: result.discountAmount,
        payableAmount: Math.max(0, listPrice - (result.discountAmount || 0)),
      };
    },
    {
      body: t.Object({
        appId: t.String(),
        couponCode: t.String({ minLength: 1, maxLength: 64 }),
        amount: t.Optional(t.Number({ minimum: 0 })),
      }),
      detail: {
        tags: ["MoR Checkout"],
        summary: "Preview Coupon Discount",
        description: "Validates a coupon code against an app and returns the computed discount without creating a transaction.",
      },
    }
  )

  /**
   * Daftar riwayat transaksi MoR
   */
  .get(
    "/transactions",
    async ({ query }) => {
      const { appId, limit = 50, mode } = query;
      let txs;
      if (appId) {
        txs = await db.query.transactions.findMany({
          where: eq(transactions.appId, appId),
          orderBy: (tx, { desc }) => [desc(tx.createdAt)],
          limit: Number(limit),
        });
      } else if (mode) {
        const appRows = await db
          .select({ id: apps.id })
          .from(apps)
          .where(eq(apps.mode, mode));
        txs = appRows.length
          ? await db.query.transactions.findMany({
              where: inArray(transactions.appId, appRows.map((a) => a.id)),
              orderBy: (tx, { desc }) => [desc(tx.createdAt)],
              limit: Number(limit),
            })
          : [];
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
        mode: t.Optional(t.Union([t.Literal("sandbox"), t.Literal("live")])),
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

      // Transaksi dari aplikasi sandbox hanyalah simulasi — tidak boleh dicairkan ke rekening asli.
      const disbApp = await db.query.apps.findFirst({ where: eq(apps.id, tx.appId) });
      if (disbApp?.mode === "sandbox") {
        set.status = 400;
        return { error: "Transaksi sandbox (simulasi) tidak dapat dicairkan. Cairkan hanya transaksi live." };
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
      const tx = await db.query.transactions.findFirst({
        where: eq(transactions.id, txId),
      });

      if (!tx) {
        set.status = 404;
        return { error: "Transaksi tidak ditemukan" };
      }

      // Simulasi pembayaran hanya boleh untuk aplikasi yang sedang dalam mode sandbox.
      const txApp = await db.query.apps.findFirst({ where: eq(apps.id, tx.appId) });
      if (txApp?.mode !== "sandbox" && !checkoutConfig.isSandbox) {
        set.status = 403;
        return { error: "Simulate paid hanya tersedia untuk aplikasi dalam mode sandbox." };
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
