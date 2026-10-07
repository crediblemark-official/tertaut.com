/**
 * Modul Checkout: Dynamic Checkout Session & Redirect (MoR Engine).
 */

import type {
  TertautExecutor,
  CheckoutOptions,
  CheckoutResult,
  CheckoutStatusResult,
} from "../types";

type RequestExecutor = TertautExecutor;

export async function executeCheckout(
  executor: RequestExecutor,
  options: CheckoutOptions
): Promise<CheckoutResult> {
  if (!options.customerEmail && !options.buyerEmail) {
    throw new Error("[Tertaut SDK] customerEmail is required for checkout.");
  }
  if (!executor.appId && !options.appSlug && !options.slug) {
    throw new Error(
      "[Tertaut SDK] appId is required for checkout session (or specify appSlug/slug)."
    );
  }

  // Catatan: `grantCredits` sengaja TIDAK pernah dikirim dari klien. Server
  // mengambilnya dari `meteringConfig.freeAllowance` produk sebagai nilai
  // otoritatif, dan mengabaikan nilai kiriman klien demi mencegah pencetakan
  // kredit gratis. Opsi ini dihapus dari tipe agar tidak menyesatkan.
  const data = await executor.requestJson<CheckoutResult>("/api/v1/checkout/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appId: executor.appId || undefined,
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
      customAmount: options.customAmount,
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
  // Server mendefinisikan GET /checkout/status/:txId (path param),
  // bukan query param txId.
  const query = ticket ? `?ticket=${encodeURIComponent(ticket)}` : "";
  return executor.requestJson<CheckoutStatusResult>(
    `/api/v1/checkout/status/${encodeURIComponent(transactionId)}${query}`
  );
}
