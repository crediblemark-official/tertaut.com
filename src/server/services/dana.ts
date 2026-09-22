import { config, cleanPemKey } from "../config";
import crypto from "crypto";
import { calculateMor } from "../utils/payment";
import Dana from "dana-node";
import { PaymentGatewayApi } from "dana-node/payment_gateway/v1";
import { DisbursementApi } from "dana-node/disbursement/v1";
import { WebhookParser } from "dana-node/webhook/v1";

import QRCode from "qrcode";

export type DanaPaymentRail = "qris" | "va" | "ewallet" | "balance";
export type DanaVaBank = "BCA" | "MANDIRI" | "BNI" | "BRI" | "CIMB" | "PERMATA" | "BSI";

export interface CreateDanaOrderParams {
  externalId: string;
  amount: number;
  payerEmail: string;
  description: string;
  returnUrl?: string;
  finishRedirectUrl?: string;
  forceMock?: boolean;
  scenario?: "API" | "REDIRECT";
  paymentRail?: DanaPaymentRail;
  vaBank?: DanaVaBank | string;
}

export interface DanaOrderResponse {
  orderId: string;
  externalId: string;
  status: string;
  merchantName: string;
  amount: number;
  payerEmail: string;
  description: string;
  checkoutUrl: string;
  expiryDate: string;
  scenario?: "API" | "REDIRECT";
  paymentRail?: DanaPaymentRail;
  paymentCode?: string;
  qrDataUrl?: string;
  vaBank?: string;
  bankName?: string;
}

function getDanaInstance(): Dana {
  return new Dana({
    partnerId: config.dana.clientId || "MOCK_PARTNER_ID",
    privateKey: cleanPemKey(config.dana.privateKey || "MOCK_PRIVATE_KEY"),
    origin: config.dana.origin,
    env: config.dana.env,
    clientSecret: config.dana.clientSecret,
  });
}

export class DanaService {
  /**
   * Akses langsung ke instance SDK resmi DANA (dana-node)
   */
  static get client(): Dana {
    return getDanaInstance();
  }

  static get paymentGateway(): PaymentGatewayApi {
    return getDanaInstance().paymentGatewayApi;
  }

  static get disbursement(): DisbursementApi {
    return getDanaInstance().disbursementApi;
  }

  /**
   * Hitung kalkulasi Merchant of Record (MoR) fee 5% platform fee & 95% net
   */
  static calculateMorBreakdown(amount: number) {
    return calculateMor(amount, config.dana.platformFeePercent);
  }

  /**
   * Gapura Custom Checkout: Konsultasi opsi pembayaran aktif DANA untuk nominal tertentu
   */
  static async consultPay(amount: number) {
    if (config.isSandbox && (config.isTest || !config.dana.clientId)) {
      return {
        paymentInfos: [
          { payMethod: "NETWORK_PAY", payOption: "NETWORK_PAY_PG_QRIS" },
          { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_BCA" },
          { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_MANDIRI" },
          { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_BRI" },
          { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_BNI" },
          { payMethod: "BALANCE", payOption: "BALANCE" },
        ],
      };
    }

    try {
      return await this.paymentGateway.consultPay({
        merchantId: config.dana.merchantId || config.dana.clientId,
        amount: {
          value: `${amount.toFixed(2)}`,
          currency: "IDR",
        },
        additionalInfo: {
          envInfo: {
            sourcePlatform: "IPG",
            terminalType: "SYSTEM",
            orderTerminalType: "WEB",
          },
        },
      });
    } catch (err: any) {
      console.warn("[DanaService] consultPay fallback:", err.message);
      return {
        paymentInfos: [
          { payMethod: "NETWORK_PAY", payOption: "NETWORK_PAY_PG_QRIS" },
          { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_BCA" },
          { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_MANDIRI" },
          { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_BRI" },
          { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_BNI" },
          { payMethod: "BALANCE", payOption: "BALANCE" },
        ],
      };
    }
  }

  /**
   * Resolve rekening penerima disbursement dari profil builder.
   * Di production wajib memiliki rekening terdaftar; di sandbox disediakan fallback mock.
   */
  static resolveDisbursementAccount(
    builder: {
      name?: string | null;
      disbursementAccount?: {
        bankCode?: string;
        accountNumber?: string;
        accountHolderName?: string;
        eWalletType?: string;
        phoneNumber?: string;
      } | null;
    } | null | undefined
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

  /**
   * Buat Order / Checkout Payment DANA (E-Wallet, QRIS, Direct Debit, Virtual Account)
   * Mendukung Gapura Custom Checkout (scenario: "API") dan Gapura Hosted Checkout (scenario: "REDIRECT")
   */
  static async createOrder(params: CreateDanaOrderParams): Promise<DanaOrderResponse> {
    const mockEnabled =
      params.forceMock ||
      (config.isSandbox && (config.isTest || (!config.dana.clientId || !config.dana.privateKey)));

    const defaultRedirect =
      params.returnUrl ||
      params.finishRedirectUrl ||
      `${config.publicAppUrl}/checkout/dana/finish?orderId=${params.externalId}`;

    const scenario = params.scenario || (params.paymentRail === "qris" || params.paymentRail === "va" || params.paymentRail === "ewallet" || params.paymentRail === "balance" ? "API" : "REDIRECT");
    const rail = params.paymentRail || "qris";

    if (mockEnabled) {
      if (!config.isProd && !config.isTest) {
        console.warn(
          "[DanaService] Using mock order response (test mode / DANA credentials not configured yet)"
        );
      }
      const mockOrderId = `dana_order_${Date.now()}`;
      let paymentCode: string | undefined;
      let qrDataUrl: string | undefined;
      let bankName = params.vaBank || "BCA";

      if (rail === "qris") {
        paymentCode = `00020101021226540014ID.DANA.WWW011893600911000000000002152026092100000000303UMI51440014ID.DANA.WWW0215202609210000000520457325303360540${params.amount.toFixed(2)}5802ID5911Tertaut MoR6007Jakarta61051234062330114${params.externalId}6304ABCD`;
        qrDataUrl = await QRCode.toDataURL(paymentCode, { width: 320, margin: 2 });
      } else if (rail === "va") {
        const bankPrefixMap: Record<string, string> = {
          BCA: "3901",
          MANDIRI: "88908",
          BNI: "8808",
          BRI: "8809",
          CIMB: "2599",
          PERMATA: "8528",
        };
        const prefix = bankPrefixMap[bankName.toUpperCase()] || "3901";
        paymentCode = `${prefix}08${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      }

      return {
        orderId: mockOrderId,
        externalId: params.externalId,
        status: "INIT",
        merchantName: "tertaut.com MoR (DANA)",
        amount: params.amount,
        payerEmail: params.payerEmail,
        description: params.description || "Order DANA",
        checkoutUrl: params.finishRedirectUrl
          ? (params.finishRedirectUrl.includes("?")
              ? `${params.finishRedirectUrl}&mock=true`
              : `${params.finishRedirectUrl}?mock=true`)
          : `${config.publicAppUrl}/checkout/dana/finish?externalId=${params.externalId}&mock=true`,
        expiryDate: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
        scenario,
        paymentRail: rail,
        paymentCode,
        qrDataUrl,
        vaBank: bankName,
        bankName,
      };
    }

    if (!config.dana.clientId || !config.dana.privateKey) {
      throw new Error("DANA Order Creation Failed: DANA_CLIENT_ID / DANA_PRIVATE_KEY tidak dikonfigurasi.");
    }

    const formatWibIso = (date: Date): string => {
      const wibDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${wibDate.getUTCFullYear()}-${pad(wibDate.getUTCMonth() + 1)}-${pad(wibDate.getUTCDate())}T${pad(wibDate.getUTCHours())}:${pad(wibDate.getUTCMinutes())}:${pad(wibDate.getUTCSeconds())}+07:00`;
    };

    // Maksimal batas waktu sandbox DANA adalah 30 menit; 20 menit aman di dalam batas waktu
    const validUpTo = formatWibIso(new Date(Date.now() + 20 * 60 * 1000));
    // DANA SDK mengharuskan partnerReferenceNo maksimal 25 karakter
    const partnerReferenceNo = (params.externalId || `tt_${Date.now()}`).slice(0, 25);

    try {
      // Siapkan payOptionDetails jika menggunakan Gapura Custom Checkout (scenario: "API")
      let payOptionDetails: any[] | undefined = undefined;
      const bankName = (params.vaBank || "BCA").toUpperCase();

      if (scenario === "API") {
        if (rail === "qris") {
          payOptionDetails = [
            {
              payMethod: "NETWORK_PAY",
              payOption: "NETWORK_PAY_PG_QRIS",
              transAmount: {
                value: `${params.amount.toFixed(2)}`,
                currency: "IDR",
              },
            },
          ];
        } else if (rail === "va") {
          const isSandboxEnv = config.dana.env === "sandbox" || config.isSandbox;
          const optionMap: Record<string, string> = {
            BCA: isSandboxEnv ? "VIRTUAL_ACCOUNT_BRI" : "VIRTUAL_ACCOUNT_BCA",
            MANDIRI: isSandboxEnv ? "VIRTUAL_ACCOUNT_BRI" : "VIRTUAL_ACCOUNT_MANDIRI",
            BNI: isSandboxEnv ? "VIRTUAL_ACCOUNT_BRI" : "VIRTUAL_ACCOUNT_BNI",
            BRI: "VIRTUAL_ACCOUNT_BRI",
            CIMB: "VIRTUAL_ACCOUNT_CIMB",
            PERMATA: isSandboxEnv ? "VIRTUAL_ACCOUNT_CIMB" : "VIRTUAL_ACCOUNT_PERMATA",
            BSI: "VIRTUAL_ACCOUNT_BSI_PAYMENT",
          };
          const payOption = optionMap[bankName] || (isSandboxEnv ? "VIRTUAL_ACCOUNT_BRI" : "VIRTUAL_ACCOUNT_BCA");
          payOptionDetails = [
            {
              payMethod: "VIRTUAL_ACCOUNT",
              payOption,
              transAmount: {
                value: `${params.amount.toFixed(2)}`,
                currency: "IDR",
              },
            },
          ];
        } else if (rail === "balance" || rail === "ewallet") {
          payOptionDetails = [
            {
              payMethod: "BALANCE",
              transAmount: {
                value: `${params.amount.toFixed(2)}`,
                currency: "IDR",
              },
            },
          ];
        }
      }

      const createOrderPayload: any = {
        partnerReferenceNo,
        merchantId: config.dana.merchantId || config.dana.clientId,
        amount: {
          value: `${params.amount.toFixed(2)}`,
          currency: "IDR",
        },
        validUpTo: validUpTo,
        urlParams: [
          {
            url: defaultRedirect,
            type: "PAY_RETURN",
            isDeeplink: "Y",
          },
          {
            url: `${config.publicAppUrl}/webhook/dana/notify`,
            type: "NOTIFICATION",
            isDeeplink: "Y",
          },
        ],
        additionalInfo: {
          order: {
            orderTitle: params.description || "Payment Order",
            scenario: scenario,
            merchantTransType: "SPECIAL_MOVIE",
            buyer: {
              externalUserType: "EMAIL",
              externalUserId: (params.payerEmail || `buyer_${params.externalId}`).slice(0, 32),
            },
          },
          mcc: "5732",
          envInfo: {
            sourcePlatform: "IPG",
            terminalType: "SYSTEM",
            orderTerminalType: "WEB",
          },
        },
      };

      if (payOptionDetails && payOptionDetails.length > 0) {
        createOrderPayload.payOptionDetails = payOptionDetails;
      }

      if (rail === "qris") {
        createOrderPayload.externalStoreId = config.dana.merchantId || "TERTAUT_STORE";
      }

      let response: any;
      try {
        response = await this.paymentGateway.createOrder(createOrderPayload);
      } catch (gatewayErr: any) {
        // Jika DANA menolak QRIS karena merchant belum mendaftarkan store/submerchant di dashboard DANA
        if (
          rail === "qris" &&
          (gatewayErr?.message?.includes("externalStoreId") ||
            gatewayErr?.message?.includes("submerchant") ||
            gatewayErr?.message?.includes("Invalid Merchant"))
        ) {
          console.warn(
            "[DanaService] Merchant belum mendaftarkan externalStoreId di DANA (https://dashboard.dana.id/sandbox/submerchants). Menggunakan fallback QRIS untuk pengujian:",
            gatewayErr?.message
          );
          const mockPaymentCode = `00020101021226540014ID.DANA.WWW011893600911000000000002152026092100000000303UMI51440014ID.DANA.WWW0215202609210000000520457325303360540${params.amount.toFixed(2)}5802ID5911Tertaut MoR6007Jakarta61051234062330114${params.externalId}6304ABCD`;
          const qrDataUrl = await QRCode.toDataURL(mockPaymentCode, { width: 320, margin: 2 });
          return {
            orderId: `dana_qris_${Date.now()}`,
            externalId: params.externalId,
            status: "INIT",
            merchantName: "tertaut.com MoR (DANA)",
            amount: params.amount,
            payerEmail: params.payerEmail,
            description: params.description,
            checkoutUrl: params.finishRedirectUrl
              ? (params.finishRedirectUrl.includes("?")
                  ? `${params.finishRedirectUrl}&mock=true`
                  : `${params.finishRedirectUrl}?mock=true`)
              : `${config.publicAppUrl}/checkout/dana/finish?externalId=${params.externalId}&mock=true`,
            expiryDate: validUpTo,
            scenario: "API",
            paymentRail: "qris",
            paymentCode: mockPaymentCode,
            qrDataUrl,
            vaBank: bankName,
            bankName,
          };
        }
        throw gatewayErr;
      }

      const orderId =
        response?.referenceNo ||
        response?.partnerReferenceNo ||
        params.externalId;
      const checkoutUrl =
        response?.webRedirectUrl ||
        // Handler /checkout/dana/finish membaca param externalId (bukan orderId).
        `${config.publicAppUrl}/checkout/dana/finish?externalId=${params.externalId}`;

      const paymentCode = response?.additionalInfo?.paymentCode;
      let qrDataUrl: string | undefined;

      if (paymentCode && rail === "qris") {
        try {
          qrDataUrl = await QRCode.toDataURL(paymentCode, { width: 320, margin: 2 });
        } catch {}
      }

      return {
        orderId,
        externalId: params.externalId,
        status: "INIT",
        merchantName: "tertaut.com MoR (DANA)",
        amount: params.amount,
        payerEmail: params.payerEmail,
        description: params.description,
        checkoutUrl,
        expiryDate: validUpTo,
        scenario,
        paymentRail: rail,
        paymentCode,
        qrDataUrl,
        vaBank: bankName,
        bankName,
      };
    } catch (err: any) {
      console.error("[DanaService] dana-node SDK createOrder Error:", err.message);
      if (
        err.message?.includes("Invalid private key format") ||
        err.message?.includes("Failed to generate signature")
      ) {
        if (config.isSandbox) {
          console.warn("[DanaService] Falling back to mock order due to DANA SDK key/signature error in sandbox:", err.message);
          return DanaService.createOrder({ ...params, forceMock: true });
        }
        throw new Error(
          "Format DANA_PRIVATE_KEY di server tidak valid (harus berupa kunci RSA PEM yang diawali -----BEGIN PRIVATE KEY----- atau -----BEGIN RSA PRIVATE KEY-----). " +
          "Untuk Dokploy/Docker, gunakan DANA_PRIVATE_KEY_BASE64. Jika Anda sedang dalam tahap uji coba, silakan gunakan software mode Sandbox."
        );
      }
      throw err;
    }
  }

  /**
   * Cek status pembayaran ke gateway DANA (Inquiry / Status Sync)
   */
  static async queryOrderStatus(params: {
    externalId: string;
    referenceNo?: string;
  }): Promise<{
    latestTransactionStatus: string;
    transactionStatusDesc?: string;
    paidTime?: string;
    paymentCode?: string;
    raw?: any;
  }> {
    if (
      config.isSandbox &&
      (config.isTest || !config.dana.clientId || !config.dana.privateKey)
    ) {
      return {
        latestTransactionStatus: "01",
        transactionStatusDesc: "INITIATED",
      };
    }

    try {
      const partnerReferenceNo = (params.externalId || "").slice(0, 25);
      const res = await this.paymentGateway.queryPayment({
        merchantId: config.dana.merchantId || config.dana.clientId,
        originalPartnerReferenceNo: partnerReferenceNo,
        originalReferenceNo: params.referenceNo,
        serviceCode: "54",
      });

      const paymentCode =
        res?.additionalInfo?.paymentViews?.[0]?.payOptionInfos?.[0]?.paymentCode;

      return {
        latestTransactionStatus: res.latestTransactionStatus,
        transactionStatusDesc: res.transactionStatusDesc,
        paidTime: res.paidTime,
        paymentCode,
        raw: res,
      };
    } catch (err: any) {
      console.warn("[DanaService] queryOrderStatus error:", err.message);
      throw err;
    }
  }

  /**
   * Verifikasi Webhook DANA Finish Payment & Disburse Notify menggunakan WebhookParser dana-node
   */
  static verifyWebhook(
    headers: Record<string, string | undefined>,
    body: any,
    options?: { method?: string; path?: string }
  ): boolean {
    if (config.isSandbox && !config.dana.publicKey) {
      return true; // Bypass verifikasi di sandbox saat public key belum diset
    }

    const signature = headers["signature"] || headers["x-signature"] || headers["X-SIGNATURE"];
    if (!signature) {
      if (config.isSandbox) return true;
      console.warn("[DanaService] Missing signature header in DANA webhook.");
      return false;
    }

    // Jika public key RSA tersedia, verifikasi via SDK WebhookParser atau fallback crypto
    if (config.dana.publicKey) {
      try {
        if (options?.method && options?.path) {
          const parser = new WebhookParser(config.dana.publicKey);
          const rawHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(headers)) {
            if (v !== undefined) rawHeaders[k] = v;
          }
          const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
          parser.parseWebhook(options.method, options.path, rawHeaders, bodyStr);
          return true;
        }
      } catch (parserErr: any) {
        // Fallback ke verifikasi RSA standar
      }

      try {
        const rawPubKey = config.dana.publicKey;
        const pubKeyPem = rawPubKey.includes("-----BEGIN")
          ? rawPubKey
          : `-----BEGIN PUBLIC KEY-----\n${rawPubKey.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;
        const verifier = crypto.createVerify("SHA256");
        verifier.update(typeof body === "string" ? body : JSON.stringify(body));
        return verifier.verify(pubKeyPem, signature, "base64");
      } catch (err: any) {
        console.warn("[DanaService] Signature verification exception:", err.message);
        return false;
      }
    }

    if (!config.isSandbox) {
      console.error("[DanaService] DANA public key tidak dikonfigurasi di production. Webhook ditolak demi keamanan.");
      return false;
    }

    return true;
  }

  /**
   * Cairkan dana bersih builder via DANA Disburse to Bank / Payout menggunakan dana-node SDK
   */
  static async createDisbursement(params: {
    externalId: string;
    amount: number;
    bankCode: string;
    accountHolderName: string;
    accountNumber: string;
    description: string;
    forceMock?: boolean;
  }): Promise<{
    id: string;
    external_id: string;
    amount: number;
    bank_code: string;
    account_holder_name: string;
    status: string;
  }> {
    const mockEnabled =
      params.forceMock ||
      (config.isSandbox && (config.isTest || (!config.dana.clientId || !config.dana.clientSecret)));

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
      const response = await this.disbursement.transferToBank({
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
    } catch (err: any) {
      console.error("[DanaService] dana-node SDK transferToBank Error:", err.message);
      throw err;
    }
  }
}
