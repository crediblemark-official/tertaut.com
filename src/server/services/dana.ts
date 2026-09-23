/**
 * DanaService — thin facade over focused DANA sub-modules.
 *
 * All callers continue to import { DanaService } from "./dana" — no changes needed
 * in existing routes or tests. Internally, logic is split across:
 *   - danaClient.ts           → SDK factory, timeout wrapper, shared types
 *   - danaOrderService.ts     → createOrder, queryOrderStatus, consultPay
 *   - danaWebhookVerifier.ts  → verifyWebhook
 *   - danaDisbursementService.ts → createDisbursement, resolveDisbursementAccount, calculateMorBreakdown
 */
import Dana from "dana-node";
import { getDanaInstance, getDanaPaymentGateway, getDanaDisbursementApi } from "./danaClient";
import { DanaOrderService } from "./danaOrderService";
import { DanaWebhookVerifier } from "./danaWebhookVerifier";
import {
  DanaDisbursementService,
  calculateMorBreakdown,
  resolveDisbursementAccount,
} from "./danaDisbursementService";

// Re-export types so existing callers can import them from "dana" without changes.
export type {
  DanaPaymentRail,
  DanaVaBank,
  CreateDanaOrderParams,
  DanaOrderResponse,
} from "./danaClient";

/**
 * Unified DANA service facade. All static methods delegate to focused sub-modules
 * while maintaining backward-compatible import surface.
 */
export class DanaService {
  /** Akses langsung ke instance SDK resmi DANA (dana-node) */
  static get client(): Dana {
    return getDanaInstance();
  }

  static get paymentGateway() {
    return getDanaPaymentGateway();
  }

  static get disbursement() {
    return getDanaDisbursementApi();
  }

  /** Hitung kalkulasi Merchant of Record (MoR) fee 5% platform fee & 95% net */
  static calculateMorBreakdown(amount: number) {
    return calculateMorBreakdown(amount);
  }

  /** Resolve rekening penerima disbursement dari profil builder */
  static resolveDisbursementAccount(builder: Parameters<typeof resolveDisbursementAccount>[0]) {
    return resolveDisbursementAccount(builder);
  }

  /** Gapura Custom Checkout: Konsultasi opsi pembayaran aktif DANA */
  static async consultPay(amount: number) {
    return DanaOrderService.consultPay(amount);
  }

  /** Buat Order / Checkout Payment DANA */
  static async createOrder(params: Parameters<typeof DanaOrderService.createOrder>[0]) {
    return DanaOrderService.createOrder(params);
  }

  /** Cek status pembayaran ke gateway DANA */
  static async queryOrderStatus(params: Parameters<typeof DanaOrderService.queryOrderStatus>[0]) {
    return DanaOrderService.queryOrderStatus(params);
  }

  /** Verifikasi Webhook DANA */
  static verifyWebhook(
    headers: Parameters<typeof DanaWebhookVerifier.verify>[0],
    body: Parameters<typeof DanaWebhookVerifier.verify>[1],
    options?: Parameters<typeof DanaWebhookVerifier.verify>[2]
  ) {
    return DanaWebhookVerifier.verify(headers, body, options);
  }

  /** Cairkan dana bersih builder via DANA Disburse to Bank */
  static async createDisbursement(
    params: Parameters<typeof DanaDisbursementService.createDisbursement>[0]
  ) {
    return DanaDisbursementService.createDisbursement(params);
  }
}
