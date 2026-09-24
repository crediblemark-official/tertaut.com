/**
 * Modul Checkout: Dynamic Checkout Session & Redirect (MoR Engine).
 */

import type { CheckoutOptions } from "../types";

export interface RequestExecutor {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  appId: string;
}

export async function executeCheckout(
  executor: RequestExecutor,
  options: CheckoutOptions
): Promise<{ checkoutUrl: string; transactionId: string }> {
  if (!options.customerEmail) {
    throw new Error("[Tertaut SDK] customerEmail is required for checkout.");
  }
  if (!executor.appId) {
    throw new Error("[Tertaut SDK] appId is required for checkout session.");
  }

  const res = await executor.request("/api/v1/checkout/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appId: executor.appId,
      amount: options.amount,
      grantDays: options.grantDays ?? 30,
      grantCredits: options.grantCredits ?? 0,
      customerEmail: options.customerEmail,
      redirectUrl: options.redirectUrl,
      couponCode: options.couponCode,
      paymentRail: options.paymentRail,
      vaBank: options.vaBank,
      customAmount: options.customAmount,
    }),
  });

  if (!res.ok) {
    throw new Error(`Checkout session failed: ${res.statusText}`);
  }

  const data = (await res.json()) as any;
  const checkoutUrl = data.checkoutUrl || data.redirectUrl || "";
  const result = {
    checkoutUrl,
    transactionId: data.transactionId,
    ...data,
  };
  if (typeof window !== "undefined" && checkoutUrl) {
    window.location.href = checkoutUrl;
  }
  return result;
}

export async function getPaymentStatus(
  executor: RequestExecutor,
  transactionId: string,
  ticket?: string
): Promise<any> {
  // BUG A1: server hanya mendefinisikan GET /checkout/status/:txId (path param),
  // bukan query param txId. Perbaiki agar method ini benar-benar bekerja.
  const query = ticket ? `?ticket=${encodeURIComponent(ticket)}` : "";
  const res = await executor.request(
    `/api/v1/checkout/status/${encodeURIComponent(transactionId)}${query}`
  );
  return res.json();
}
