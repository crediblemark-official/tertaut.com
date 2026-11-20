/**
 * Modul Checkout: Dynamic Checkout Session & Redirect (MoR Engine).
 */

import type {
  TertautExecutor,
  CheckoutOptions,
  CheckoutResult,
  CheckoutStatusResult,
  ValidateCouponOptions,
  ValidateCouponResult,
  PaymentChannelsResult,
} from "../types";

type RequestExecutor = TertautExecutor;

export async function executeCheckout(
  executor: RequestExecutor,
  options: CheckoutOptions
): Promise<CheckoutResult> {
  if (!options || typeof options !== "object") {
    throw new Error("[Tertaut SDK] options is required for checkout.");
  }
  if (!options.customerEmail && !options.buyerEmail) {
    throw new Error("[Tertaut SDK] customerEmail is required for checkout.");
  }
  if (!executor.appId && !options.appSlug && !options.slug) {
    throw new Error(
      "[Tertaut SDK] appId is required for checkout session (or specify appSlug/slug)."
    );
  }

  const data = await executor.requestJson<CheckoutResult>("/api/v1/checkout/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appId: options.appSlug || options.slug ? undefined : executor.appId || undefined,
      appSlug: options.appSlug,
      slug: options.slug,
      amount: options.amount,
      customerEmail: options.customerEmail,
      buyerEmail: options.buyerEmail,
      grantDays: options.grantDays ?? 30,
      redirectUrl: options.redirectUrl,
      couponCode: options.couponCode,
      paymentGateway: options.paymentGateway,
      paymentRail: options.paymentRail,
      preferredPaymentChannel: options.preferredPaymentChannel,
      vaBank: options.vaBank,
      bank: options.bank,
      ewalletChannel: options.ewalletChannel,
      retailOutlet: options.retailOutlet,
      ewalletPhone: options.ewalletPhone || options.phone,
      customAmount: options.customAmount,
      customerName: options.customerName,
      metadata: options.metadata,
      startTrial: options.startTrial,
      isTrial: options.isTrial,
    }),
  });

  const shouldAutoRedirect = options.autoRedirect !== false;
  const checkoutUrl = data.checkoutUrl || data.redirectUrl || "";
  if (shouldAutoRedirect && typeof window !== "undefined" && checkoutUrl) {
    window.location.href = checkoutUrl;
  }
  return { ...data, checkoutUrl };
}

export async function getPaymentStatus(
  executor: RequestExecutor,
  transactionId: string,
  ticket?: string
): Promise<CheckoutStatusResult> {
  if (!transactionId) {
    throw new Error("[Tertaut SDK] transactionId is required to check payment status.");
  }
  // Server mendefinisikan GET /checkout/status/:txId (path param),
  // bukan query param txId.
  const query = ticket ? `?ticket=${encodeURIComponent(ticket)}` : "";
  return executor.requestJson<CheckoutStatusResult>(
    `/api/v1/checkout/status/${encodeURIComponent(transactionId)}${query}`
  );
}

export async function validateCoupon(
  executor: RequestExecutor,
  options: ValidateCouponOptions
): Promise<ValidateCouponResult> {
  if (!options || !options.couponCode) {
    throw new Error("[Tertaut SDK] couponCode is required to validate coupon.");
  }
  return executor.requestJson<ValidateCouponResult>("/api/v1/checkout/validate-coupon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      couponCode: options.couponCode,
      amount: options.amount,
      appId: options.slug ? undefined : options.appId || executor.appId || undefined,
      slug: options.slug,
    }),
  });
}

export async function getPaymentChannels(
  executor: RequestExecutor
): Promise<PaymentChannelsResult> {
  return executor.requestJson<PaymentChannelsResult>("/api/v1/checkout/channels");
}
