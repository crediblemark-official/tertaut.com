import { config } from "../config";
import { calculateMor } from "../utils/payment";
import { getDanaDisbursementApi } from "./danaClient";

/**
 * Hitung kalkulasi Merchant of Record (MoR) fee 5% platform fee & 95% net
 */
export function calculateMorBreakdown(amount: number) {
  return calculateMor(amount, config.dana.platformFeePercent);
}

/**
 * Resolve rekening penerima disbursement dari profil builder.
 * Di production wajib memiliki rekening terdaftar; di sandbox disediakan fallback mock.
 */
export function resolveDisbursementAccount(
  builder:
    | {
        name?: string | null;
        disbursementAccount?: {
          bankCode?: string;
          accountNumber?: string;
          accountHolderName?: string;
          eWalletType?: string;
          phoneNumber?: string;
        } | null;
      }
    | null
    | undefined
): {
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
} | null {
  const acc = builder?.disbursementAccount;

  if (acc?.accountNumber && acc?.bankCode) {
    return {
      bankCode: acc.bankCode,
      accountNumber: acc.accountNumber,
      accountHolderName: acc.accountHolderName || builder?.name || "Builder",
    };
  }

  if (config.isSandbox) {
    return {
      bankCode: "BCA",
      accountNumber: "1234567890000",
      accountHolderName: builder?.name || "Sandbox Builder",
    };
  }

  return null;
}

export interface CreateDisbursementParams {
  externalId: string;
  amount: number;
  bankCode: string;
  accountHolderName: string;
  accountNumber: string;
  description: string;
  forceMock?: boolean;
}

export interface DisbursementResult {
  id: string;
  external_id: string;
  amount: number;
  bank_code: string;
  account_holder_name: string;
  status: string;
}

/**
 * Cairkan dana bersih builder via DANA Disburse to Bank / Payout menggunakan dana-node SDK
 */
export class DanaDisbursementService {
  static async createDisbursement(params: CreateDisbursementParams): Promise<DisbursementResult> {
    const mockEnabled =
      params.forceMock ||
      (config.isSandbox && (config.isTest || !config.dana.clientId || !config.dana.clientSecret));

    if (mockEnabled) {
      return {
        id: `dana_disb_mock_${Date.now()}`,
        external_id: params.externalId,
        amount: params.amount,
        bank_code: params.bankCode,
        account_holder_name: params.accountHolderName,
        status: "COMPLETED",
      };
    }

    if (!config.dana.clientId || !config.dana.clientSecret) {
      throw new Error("DANA Disbursement Failed: Kredensial DANA tidak dikonfigurasi.");
    }

    try {
      const disbursementApi = getDanaDisbursementApi();
      const response = await disbursementApi.transferToBank({
        partnerReferenceNo: params.externalId,
        customerNumber: "6280000000000",
        beneficiaryAccountNumber: params.accountNumber,
        beneficiaryBankCode: params.bankCode,
        amount: {
          currency: "IDR",
          value: `${params.amount.toFixed(2)}`,
        },
        additionalInfo: {
          fundType: "1",
          beneficiaryName: params.accountHolderName,
          remark: params.description,
        } as any,
      });

      const responseCode = (response as any)?.responseCode;
      // DANA SNAP BI: 2004300/2001800 = instant success, 2024300 = in-progress (akan difinalisasi via webhook)
      const isInstantSuccess = responseCode === "2004300" || responseCode === "2001800";
      const status = isInstantSuccess ? "COMPLETED" : "PROCESSING";

      return {
        id: response?.referenceNo || `dana_disb_${Date.now()}`,
        external_id: params.externalId,
        amount: params.amount,
        bank_code: params.bankCode,
        account_holder_name: params.accountHolderName,
        status,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[DanaDisbursementService] dana-node SDK transferToBank Error:", message);
      throw err;
    }
  }
}
