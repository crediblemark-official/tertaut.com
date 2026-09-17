import { Elysia } from "elysia";
import { handleXenditInvoiceWebhook, handleXenditDisbursementWebhook } from "./xendit";
import { handleDanaFinishPaymentWebhook, handleDanaDisburseNotifyWebhook } from "./dana";
import { webhookSchema, danaWebhookSchema, danaDisburseWebhookSchema } from "./schemas";


export const webhookRoutes = new Elysia({ prefix: "/webhook" })
  /**
   * Webhook callback handler dari Xendit Invoice (Idempotent & Secured)
   */
  .post("/xendit", handleXenditInvoiceWebhook, webhookSchema)
  .post("/xendit/invoice", handleXenditInvoiceWebhook, webhookSchema)
  /**
   * Webhook callback handler dari Xendit Disbursement/Payout
   */
  .post("/xendit/disbursement", handleXenditDisbursementWebhook, danaDisburseWebhookSchema)
  /**
   * Webhook callback handler dari DANA Finish Notify API
   */
  .post("/dana/finish-payment", handleDanaFinishPaymentWebhook, danaWebhookSchema)
  .post("/dana/notify", handleDanaFinishPaymentWebhook, danaWebhookSchema)
  /**
   * Webhook callback handler dari DANA Disburse to Bank Notify API
   */
  .post("/dana/disburse-notify", handleDanaDisburseNotifyWebhook, danaDisburseWebhookSchema);

export const webhooksPluralRoutes = new Elysia({ prefix: "/webhooks" })
  .post("/xendit/invoice", handleXenditInvoiceWebhook, webhookSchema)
  .post("/xendit/disbursement", handleXenditDisbursementWebhook, danaDisburseWebhookSchema)
  .post("/dana/finish-payment", handleDanaFinishPaymentWebhook, danaWebhookSchema)
  .post("/dana/disburse-notify", handleDanaDisburseNotifyWebhook, danaDisburseWebhookSchema);

export const snapBiWebhookRoutes = new Elysia()
  .post("/v1.0/debit/notify", handleDanaFinishPaymentWebhook, danaWebhookSchema)
  .post("/v1.0/emoney/transfer-bank-notify.htm", handleDanaDisburseNotifyWebhook, danaDisburseWebhookSchema);
