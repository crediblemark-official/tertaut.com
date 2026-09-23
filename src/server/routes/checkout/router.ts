import { Elysia, t } from "elysia";
import { authenticate } from "../../middleware/auth";
import { handleDanaFinishPaymentWebhook } from "../webhook/dana";
import { danaWebhookSchema } from "../webhook/schemas";
import { handleCreateSession } from "./session";
import {
  handleDanaFinish,
  handleGetPaymentStatus,
  handleConsultPay,
  handlePreviewCoupon,
  handleListTransactions,
  handleDisburseTx,
  handleSimulatePaid,
  handleGetInvoiceData,
} from "./handlers";

/** Endpoint checkout yang memang harus publik (webhook, buat sesi, preview kupon, redirect DANA, polling status, invoice). */
const PUBLIC_CHECKOUT_PATHS = [
  "webhook",
  "/session",
  "preview-coupon",
  "dana/finish",
  "/status",
  "consult-pay",
  "/invoice",
];

export const checkoutRoutes = new Elysia({ prefix: "/checkout" })
  // Dashboard-only: /transactions, /disburse/:txId, /simulate-paid/:txId
  .onBeforeHandle(async ({ request: { headers }, status, path }) => {
    if (PUBLIC_CHECKOUT_PATHS.some((p) => path.includes(p))) return;
    const res = await authenticate(headers);
    if ("status" in res) return status(res.status, { error: res.error });
  })
  /**
   * Webhook DANA Finish Payment Callback
   */
  .post("/webhook/dana", handleDanaFinishPaymentWebhook, danaWebhookSchema)
  .post("/webhook/dana/finish-payment", handleDanaFinishPaymentWebhook, danaWebhookSchema)
  /**
   * Pemicu Dynamic & Headless Checkout Link (Gapura Custom & Hosted)
   */
  .post("/session", handleCreateSession, {
    body: t.Object({
      appId: t.Optional(t.String()),
      appSlug: t.Optional(t.String()),
      slug: t.Optional(t.String()),
      paymentGateway: t.Optional(t.String()),
      scenario: t.Optional(t.Union([t.Literal("API"), t.Literal("REDIRECT")])),
      paymentRail: t.Optional(t.Union([t.Literal("qris"), t.Literal("va"), t.Literal("ewallet")])),
      preferredPaymentChannel: t.Optional(t.String()),
      vaBank: t.Optional(t.String()),
      bank: t.Optional(t.String()),
      amount: t.Optional(t.Number({ minimum: 0 })),
      customAmount: t.Optional(t.Number({ minimum: 0 })),
      customerEmail: t.Optional(t.String()),
      buyerEmail: t.Optional(t.String()),
      grantDays: t.Optional(t.Number({ default: 365 })),
      redirectUrl: t.Optional(t.String()),
      couponCode: t.Optional(t.String({ maxLength: 64 })),
      startTrial: t.Optional(t.Boolean()),
      isTrial: t.Optional(t.Boolean()),
    }),
    detail: {
      tags: ["MoR Checkout"],
      summary: "Create Dynamic Checkout Session",
      description:
        "Membuat sesi pembayaran dinamis (QRIS / Virtual Account) sebagai Merchant of Record resmi. Menghitung DPP & PPN 11%, memotong 5% flat platform fee, dan mengembalikan checkout URL beserta data transaksi.",
      responses: {
        200: {
          description: "Sesi checkout berhasil dibuat",
        },
        400: {
          description: "Parameter request tidak valid atau kupon tidak berlaku",
        },
        403: {
          description:
            "Aplikasi atau builder dalam status ditangguhkan (APP_SUSPENDED / BUILDER_SUSPENDED)",
        },
      },
    },
  })
  /**
   * Cek status pembayaran real-time (Polling untuk Gapura Custom Checkout)
   */
  .get("/status/:txId", handleGetPaymentStatus, {
    params: t.Object({ txId: t.String({ description: "ID transaksi checkout (mis. tx_...)" }) }),
    query: t.Object({
      ticket: t.Optional(t.String({ description: "HMAC ticket keamanan hasil pembuatan sesi" })),
    }),
    detail: {
      tags: ["MoR Checkout"],
      summary: "Get Payment Status",
      description:
        "Polling status pembayaran transaksi. Mengembalikan status pembayaran ('PAID', 'PENDING', 'EXPIRED'), kunci lisensi yang diterbitkan (jika sudah lunas), dan invoice URL.",
      responses: {
        200: {
          description: "Status transaksi terkini",
        },
        404: {
          description: "Transaksi tidak ditemukan",
        },
      },
    },
  })
  /**
   * Konsultasi opsi pembayaran DANA aktif
   */
  .get("/consult-pay", handleConsultPay, {
    query: t.Object({
      amount: t.Optional(t.Numeric({ description: "Nominal transaksi dalam Rupiah" })),
    }),
    detail: {
      tags: ["MoR Checkout"],
      summary: "Consult Payment Options",
      description:
        "Mengecek ketersediaan channel pembayaran aktif (QRIS, VA Bank) dan limit nominal dari gateway pembayaran.",
      responses: {
        200: {
          description: "Daftar opsi pembayaran yang tersedia",
        },
      },
    },
  })
  /**
   * Endpoint Redirect pembeli setelah menyelesaikan pembayaran DANA
   */
  .get("/dana/finish", handleDanaFinish)
  /**
   * Preview kupon tanpa membuat transaksi
   */
  .post("/preview-coupon", handlePreviewCoupon, {
    body: t.Object({
      appId: t.String(),
      couponCode: t.String({ minLength: 1, maxLength: 64 }),
      amount: t.Optional(t.Number({ minimum: 0 })),
    }),
    detail: {
      tags: ["MoR Checkout"],
      summary: "Preview Coupon Discount",
      description:
        "Validasi kupon diskon dan estimasi potongan harga sebelum pembeli melakukan checkout.",
      responses: {
        200: {
          description: "Detail kalkulasi diskon kupon",
        },
      },
    },
  })
  /**
   * Daftar riwayat transaksi MoR
   */
  .get("/transactions", handleListTransactions, {
    query: t.Object({
      appId: t.Optional(t.String()),
      limit: t.Optional(t.Numeric({ default: 50 })),
      mode: t.Optional(t.Union([t.Literal("sandbox"), t.Literal("live")])),
    }),
    detail: {
      tags: ["MoR Checkout"],
      summary: "List MoR Transactions",
      description: "Daftar transaksi penjualan MoR untuk aplikasi milik builder.",
    },
  })
  /**
   * Trigger pencairan saldo (Xendit Disbursement) manual / instant payout
   */
  .post("/disburse/:txId", handleDisburseTx, {
    params: t.Object({ txId: t.String() }),
    detail: {
      tags: ["MoR Checkout"],
      summary: "Trigger Xendit Disbursement",
      description: "Memicu pencairan saldo instan untuk transaksi tertentu.",
    },
  })
  /**
   * One-Click Local Payment Simulator for Developers (Hanya Sandbox)
   */
  .post("/simulate-paid/:txId", handleSimulatePaid, {
    params: t.Object({ txId: t.String() }),
    detail: {
      tags: ["MoR Checkout"],
      summary: "Simulate Successful Payment (Local Developer Sandbox)",
      description:
        "Simulasi pembayaran sukses instan untuk pengujian di lingkungan sandbox tanpa perlu melakukan transfer uang nyata.",
    },
  })
  /**
   * Detail Invoice & E-Receipt Resmi
   */
  .get("/invoice/:txId", handleGetInvoiceData, {
    params: t.Object({ txId: t.String({ description: "ID transaksi checkout (mis. tx_...)" }) }),
    query: t.Object({
      ticket: t.Optional(t.String({ description: "HMAC ticket keamanan dari checkout" })),
    }),
    detail: {
      tags: ["MoR Checkout"],
      summary: "Get Official Invoice / E-Receipt",
      description:
        "Mengambil data invoice resmi Merchant of Record dengan rincian DPP (Dasar Pengenaan Pajak), PPN 11%, item software, dan nomor lisensi yang siap dicetak. Memerlukan HMAC ticket pembeli atau sesi admin.",
      responses: {
        200: {
          description: "Data invoice resmi lengkap",
        },
        403: {
          description: "Akses ditolak (ticket HMAC tidak valid)",
        },
        404: {
          description: "Transaksi tidak ditemukan",
        },
      },
    },
  });
