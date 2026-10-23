import { Elysia, t } from "elysia";
import { handleSimulateSandboxPayment } from "./simulatePayment";
import { handleSandboxPaymentWebhook } from "./webhook";

/**
 * Modul Router Khusus Sandbox & Simulasi UAT Tertaut.
 *
 * Seluruh endpoint pengujian dan simulasi pembayaran terisolasi di dalam
 * router ini dan terpisah dari rute transaksi produksi riil.
 */
export const sandboxRoutes = new Elysia({ prefix: "/sandbox" })
  .post("/simulate-payment", handleSimulateSandboxPayment, {
    body: t.Object({
      transactionId: t.String(),
      ticket: t.String(),
      scenario: t.Optional(t.String()),
      failureReason: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Sandbox & Testing"],
      summary: "Simulate Sandbox Payment",
      description: "Mensimulasikan pelunasan pembayaran instan untuk transaksi dalam mode Sandbox.",
    },
  })
  .post("/webhook", handleSandboxPaymentWebhook, {
    body: t.Object({
      transactionId: t.Optional(t.String()),
      id: t.Optional(t.String()),
      externalId: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Sandbox & Testing"],
      summary: "Trigger Sandbox Payment Webhook",
      description: "Memanggil webhook internal untuk simulasi pembayaran sandbox.",
    },
  });

/**
 * Backward-compatibility alias route untuk alur checkout klien lama
 * yang memanggil POST /api/v1/checkout/simulate-payment.
 */
export const legacySandboxCheckoutRoutes = new Elysia({ prefix: "/checkout" }).post(
  "/simulate-payment",
  handleSimulateSandboxPayment,
  {
    body: t.Object({
      transactionId: t.String(),
      ticket: t.String(),
      scenario: t.Optional(t.String()),
      failureReason: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Sandbox & Testing"],
      summary: "Legacy Checkout Simulate Sandbox Payment",
      description: "Alias rute checkout untuk simulasi pembayaran sandbox.",
    },
  }
);
