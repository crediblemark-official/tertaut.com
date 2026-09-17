import { Elysia, t } from "elysia";
import { authenticate } from "../../middleware/auth";
import { handleXenditInvoiceWebhook } from "../webhook/xendit";
import { handleDanaFinishPaymentWebhook } from "../webhook/dana";
import { webhookSchema, danaWebhookSchema } from "../webhook/schemas";
import { handleCreateSession } from "./session";
import {
  handleDanaFinish,
  handlePreviewCoupon,
  handleListTransactions,
  handleDisburseTx,
  handleSimulatePaid,
} from "./handlers";

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
  .post("/webhook/xendit", handleXenditInvoiceWebhook, webhookSchema)
  /**
   * Webhook DANA Finish Payment Callback
   */
  .post("/webhook/dana", handleDanaFinishPaymentWebhook, danaWebhookSchema)
  .post("/webhook/dana/finish-payment", handleDanaFinishPaymentWebhook, danaWebhookSchema)
  /**
   * Pemicu Dynamic & Headless Checkout Link
   */
  .post("/session", handleCreateSession, {
    body: t.Object({
      appId: t.Optional(t.String()),
      appSlug: t.Optional(t.String()),
      slug: t.Optional(t.String()),
      paymentGateway: t.Optional(t.String()),
      paymentRail: t.Optional(t.Union([t.Literal("qris"), t.Literal("va"), t.Literal("ewallet")])),
      amount: t.Optional(t.Number({ minimum: 1000 })),
      customAmount: t.Optional(t.Number({ minimum: 1000 })),
      customerEmail: t.Optional(t.String()),
      buyerEmail: t.Optional(t.String()),
      grantDays: t.Optional(t.Number({ default: 365 })),
      grantCredits: t.Optional(t.Number({ default: 0 })),
      redirectUrl: t.Optional(t.String()),
      couponCode: t.Optional(t.String({ maxLength: 64 })),
    }),
    detail: {
      tags: ["MoR Checkout"],
      summary: "Create Dynamic Checkout Session",
      description: "Creates a dynamic invoice session (Xendit / DANA) with 5% MoR platform fee auto-deducted",
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
      description: "Validates a coupon code against an app and returns the computed discount without creating a transaction.",
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
    },
  });
