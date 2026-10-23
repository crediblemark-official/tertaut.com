import { Elysia } from "elysia";
import { handleXenditRefundWebhook } from "./refund";
import { handleXenditInvoiceWebhook, handleXenditDisbursementWebhook } from "./xendit";
import { handleSandboxPaymentWebhook } from "../sandbox/webhook";

function mountCallbacks(prefix: string) {
  return new Elysia({ prefix })
    .post("/xendit", handleXenditInvoiceWebhook)
    .post("/xendit/invoice", handleXenditInvoiceWebhook)
    .post("/xendit/disbursement", handleXenditDisbursementWebhook)
    .post("/xendit/refund", handleXenditRefundWebhook)
    .post("/sandbox", handleSandboxPaymentWebhook);
}
export const webhookRoutes = mountCallbacks("/webhook");
export const webhooksPluralRoutes = mountCallbacks("/webhooks");
