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

  const data = (await res.json()) as { checkoutUrl: string; transactionId: string };
  if (typeof window !== "undefined" && data.checkoutUrl) {
    window.location.href = data.checkoutUrl;
  }
  return data;
}

export async function getPaymentStatus(
  executor: RequestExecutor,
  transactionId: string,
  ticket?: string
): Promise<any> {
  const query = ticket
    ? `?txId=${transactionId}&ticket=${encodeURIComponent(ticket)}`
    : `?txId=${transactionId}`;
  const res = await executor.request(`/api/v1/checkout/status${query}`);
  return res.json();
}
