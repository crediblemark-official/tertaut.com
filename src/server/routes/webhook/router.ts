import { Elysia } from "elysia";
import { handleDanaFinishPaymentWebhook, handleDanaDisburseNotifyWebhook } from "./dana";
import { danaWebhookSchema, danaDisburseWebhookSchema } from "./schemas";

export const webhookRoutes = new Elysia({ prefix: "/webhook" })
  /**
   * Webhook callback handler dari DANA Finish Notify API (SNAP BI & Webhook)
   */
  .post("/dana/finish-payment", handleDanaFinishPaymentWebhook, danaWebhookSchema)
  .post("/dana/notify", handleDanaFinishPaymentWebhook, danaWebhookSchema)
  /**
   * Webhook callback handler dari DANA Disburse to Bank Notify API
   */
  .post("/dana/disburse-notify", handleDanaDisburseNotifyWebhook, danaDisburseWebhookSchema);

export const webhooksPluralRoutes = new Elysia({ prefix: "/webhooks" })
  .post("/dana/finish-payment", handleDanaFinishPaymentWebhook, danaWebhookSchema)
  .post("/dana/disburse-notify", handleDanaDisburseNotifyWebhook, danaDisburseWebhookSchema);

export const snapBiWebhookRoutes = new Elysia()
  .post("/v1.0/debit/notify", handleDanaFinishPaymentWebhook, danaWebhookSchema)
  .post("/v1.0/emoney/transfer-bank-notify.htm", handleDanaDisburseNotifyWebhook, danaDisburseWebhookSchema);
