import type {
  PaymentGatewayAdapter,
  CreateGatewayOrderParams,
  GatewayOrderResponse,
  GatewayStatusResponse,
  GatewayDisbursementParams,
  GatewayDisbursementResponse,
  MorBreakdown,
} from "./types";
import { DanaService } from "../dana";

/**
 * DANA Gateway Adapter
 * Menggunakan official SDK `dana-node` secara terisolasi tanpa menyentuh kode gateway lain.
 */
export class DanaGatewayAdapter implements PaymentGatewayAdapter {
  readonly id = "dana" as const;
  readonly displayName = "DANA";

  calculateMor(amount: number): MorBreakdown {
    return DanaService.calculateMorBreakdown(amount);
  }

  async createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResponse> {
    return DanaService.createOrder({
      externalId: params.externalId,
      amount: params.amount,
      payerEmail: params.payerEmail,
      description: params.description,
      returnUrl: params.returnUrl,
      finishRedirectUrl: params.finishRedirectUrl,
      forceMock: params.forceMock,
      allowMock: params.allowMock,
      scenario: params.scenario,
      paymentRail: params.paymentRail as any,
      vaBank: params.vaBank,
    });
  }

  async queryOrderStatus(params: {
    externalId: string;
    referenceNo?: string;
  }): Promise<GatewayStatusResponse> {
    try {
      const res = await DanaService.queryOrderStatus({
        externalId: params.externalId,
        referenceNo: params.referenceNo,
      });

      if (!res) {
        return { isPaid: false, isExpired: false, isFailed: false };
      }

      const isPaid = res.latestTransactionStatus === "00";
      const isExpired = res.latestTransactionStatus === "05";
      const isFailed = res.latestTransactionStatus === "06";

      const rawAmountValue =
        (res.raw as any)?.amount?.value ??
        (res.raw as any)?.transAmount?.value ??
        (res.raw as any)?.orderAmount?.value ??
        (res.raw as any)?.totalAmount?.value ??
        (res.raw as any)?.amount;

      const paidAmount = Number.isFinite(Number(rawAmountValue))
        ? Math.round(Number(rawAmountValue))
        : undefined;

      return {
        isPaid,
        isExpired,
        isFailed,
        paidAmount,
        paymentCode: res.paymentCode,
        raw: res.raw,
      };
    } catch {
      return { isPaid: false, isExpired: false, isFailed: false };
    }
  }

  async verifyWebhook(headers: Record<string, string | undefined>, body?: any): Promise<boolean> {
    const res = DanaService.verifyWebhook(headers as any, body);
    return Boolean(res);
  }

  async createDisbursement(
    params: GatewayDisbursementParams
  ): Promise<GatewayDisbursementResponse> {
    const res = await DanaService.createDisbursement({
      externalId: params.externalId,
      amount: params.amount,
      bankCode: params.bankCode,
      accountHolderName: params.accountHolderName,
      accountNumber: params.accountNumber,
      description: params.description,
    });

    return {
      id: res.id,
      externalId: res.external_id,
      amount: res.amount,
      bankCode: res.bank_code,
      accountHolderName: res.account_holder_name,
      status: res.status,
    };
  }
}

export const danaGateway = new DanaGatewayAdapter();
