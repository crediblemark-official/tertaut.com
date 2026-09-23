import { config } from "../config";
import QRCode from "qrcode";
import {
  getDanaPaymentGateway,
  withDanaTimeout,
  CreateDanaOrderParams,
  DanaOrderResponse,
} from "./danaClient";

// ─── Mock Order Factory ───────────────────────────────────────────────────────

/**
 * Buat order DANA mock (sandbox / test mode / merchant belum siap).
 * Digunakan oleh createOrder di dua tempat: path mock utama dan fallback QRIS.
 */
async function buildMockOrder(
  params: CreateDanaOrderParams,
  scenario: "API" | "REDIRECT",
  rail: string,
  bankName: string
): Promise<DanaOrderResponse> {
  const mockOrderId = `dana_order_${Date.now()}`;
  let paymentCode: string | undefined;
  let qrDataUrl: string | undefined;

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
      ? params.finishRedirectUrl.includes("?")
        ? `${params.finishRedirectUrl}&mock=true`
        : `${params.finishRedirectUrl}?mock=true`
      : `${config.publicAppUrl}/checkout/dana/finish?externalId=${params.externalId}&mock=true`,
    expiryDate: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    scenario,
    paymentRail: rail as DanaOrderResponse["paymentRail"],
    paymentCode,
    qrDataUrl,
    vaBank: bankName,
    bankName,
    mock: true,
  };
}

// ─── DanaOrderService ─────────────────────────────────────────────────────────

export class DanaOrderService {
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
      return await withDanaTimeout(
        "consultPay",
        getDanaPaymentGateway().consultPay({
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
        })
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[DanaOrderService] consultPay fallback:", message);
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
   * Buat Order / Checkout Payment DANA (E-Wallet, QRIS, Direct Debit, Virtual Account)
   * Mendukung Gapura Custom Checkout (scenario: "API") dan Gapura Hosted Checkout (scenario: "REDIRECT")
   */
  static async createOrder(params: CreateDanaOrderParams): Promise<DanaOrderResponse> {
    // Kebijakan mock (BUG-1 + opsional demo non-prod):
    //  - Aplikasi sandbox (allowMock=true): mock penuh, bisa di-fulfill.
    //  - Aplikasi Live di deployment PRODUKSI: 100% gateway asli — forceMock
    //    ditolak dan fallback otomatis nonaktif (tidak pernah ada mock).
    //  - Aplikasi Live di deployment NON-produksi: boleh mendapat invoice DEMO
    //    (fallback QRIS / key error) agar UI checkout tetap berfungsi, TAPI
    //    session selalu menyimpan mockOrder=false untuk app Live sehingga
    //    invoice demo itu TIDAK PERNAH bisa mem-fulfill lisensi.
    const allowMock = params.allowMock ?? config.isSandbox;
    if (params.forceMock && !allowMock && config.isProd) {
      throw new Error(
        "Mock order ditolak: aplikasi mode Live di environment produksi tidak boleh membuat order mock (forceMock)."
      );
    }
    const mockEnabled =
      params.forceMock ||
      (allowMock &&
        config.isSandbox &&
        (config.isTest || !config.dana.clientId || !config.dana.privateKey));

    const defaultRedirect =
      params.returnUrl ||
      params.finishRedirectUrl ||
      `${config.publicAppUrl}/checkout/dana/finish?orderId=${params.externalId}`;

    const scenario =
      params.scenario ||
      (params.paymentRail === "qris" ||
      params.paymentRail === "va" ||
      params.paymentRail === "ewallet" ||
      params.paymentRail === "balance"
        ? "API"
        : "REDIRECT");
    const rail = params.paymentRail || "qris";
    const bankName = (params.vaBank || "BCA").toUpperCase();

    if (mockEnabled) {
      if (!config.isProd && !config.isTest) {
        console.warn(
          "[DanaOrderService] Using mock order response (test mode / DANA credentials not configured yet)"
        );
      }
      return buildMockOrder(params, scenario, rail, bankName);
    }

    if (!config.dana.clientId || !config.dana.privateKey) {
      throw new Error(
        "DANA Order Creation Failed: DANA_CLIENT_ID / DANA_PRIVATE_KEY tidak dikonfigurasi."
      );
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
      let payOptionDetails: unknown[] | undefined = undefined;

      if (scenario === "API") {
        if (rail === "qris") {
          payOptionDetails = [
            {
              payMethod: "NETWORK_PAY",
              payOption: "NETWORK_PAY_PG_QRIS",
              transAmount: { value: `${params.amount.toFixed(2)}`, currency: "IDR" },
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
          const payOption =
            optionMap[bankName] || (isSandboxEnv ? "VIRTUAL_ACCOUNT_BRI" : "VIRTUAL_ACCOUNT_BCA");
          payOptionDetails = [
            {
              payMethod: "VIRTUAL_ACCOUNT",
              payOption,
              transAmount: { value: `${params.amount.toFixed(2)}`, currency: "IDR" },
            },
          ];
        } else if (rail === "balance" || rail === "ewallet") {
          payOptionDetails = [
            {
              payMethod: "BALANCE",
              transAmount: { value: `${params.amount.toFixed(2)}`, currency: "IDR" },
            },
          ];
        }
      }

      const createOrderPayload: Record<string, unknown> = {
        partnerReferenceNo,
        merchantId: config.dana.merchantId || config.dana.clientId,
        amount: { value: `${params.amount.toFixed(2)}`, currency: "IDR" },
        validUpTo,
        urlParams: [
          { url: defaultRedirect, type: "PAY_RETURN", isDeeplink: "Y" },
          {
            url: `${config.publicAppUrl}/webhook/dana/notify`,
            type: "NOTIFICATION",
            isDeeplink: "Y",
          },
        ],
        additionalInfo: {
          order: {
            orderTitle: params.description || "Payment Order",
            scenario,
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
        response = await withDanaTimeout(
          "createOrder",
          getDanaPaymentGateway().createOrder(createOrderPayload as any)
        );
      } catch (gatewayErr: unknown) {
        const gatewayMessage =
          gatewayErr instanceof Error ? gatewayErr.message : String(gatewayErr);
        // Jika DANA menolak QRIS karena merchant belum mendaftarkan store/submerchant di dashboard DANA.
        // Fallback QRIS mock untuk: (a) aplikasi sandbox (allowMock), atau (b) deployment non-produksi —
        // aplikasi Live di non-prod mendapat invoice DEMO (mock:true) yang dicatat session sebagai
        // mockOrder=false sehingga tidak pernah mem-fulfill lisensi. Di produksi, aplikasi Live wajib
        // menerima error asli agar konfigurasi merchant diperbaiki, bukan di-mock.
        if (
          (allowMock || !config.isProd) &&
          rail === "qris" &&
          (gatewayMessage.includes("externalStoreId") ||
            gatewayMessage.includes("submerchant") ||
            gatewayMessage.includes("Invalid Merchant"))
        ) {
          console.warn(
            "[DanaOrderService] Merchant belum mendaftarkan externalStoreId di DANA (https://dashboard.dana.id/sandbox/submerchants). Menggunakan fallback QRIS untuk pengujian:",
            gatewayMessage
          );
          return buildMockOrder(params, "API", "qris", bankName);
        }
        throw gatewayErr;
      }

      const orderId = response?.referenceNo || response?.partnerReferenceNo || params.externalId;
      const checkoutUrl =
        response?.webRedirectUrl ||
        // Handler /checkout/dana/finish membaca param externalId (bukan orderId).
        `${config.publicAppUrl}/checkout/dana/finish?externalId=${params.externalId}`;

      const paymentCode = response?.additionalInfo?.paymentCode;
      let qrDataUrl: string | undefined;

      if (paymentCode && rail === "qris") {
        try {
          qrDataUrl = await QRCode.toDataURL(paymentCode, { width: 320, margin: 2 });
        } catch {
          /* ignore QR generation errors */
        }
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
        paymentRail: rail as DanaOrderResponse["paymentRail"],
        paymentCode,
        qrDataUrl,
        vaBank: bankName,
        bankName,
        mock: false,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[DanaOrderService] dana-node SDK createOrder Error:", message);
      if (
        message.includes("Invalid private key format") ||
        message.includes("Failed to generate signature")
      ) {
        if (config.isSandbox) {
          console.warn(
            "[DanaOrderService] Falling back to mock order due to DANA SDK key/signature error in sandbox:",
            message
          );
          return DanaOrderService.createOrder({ ...params, forceMock: true });
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
  static async queryOrderStatus(params: { externalId: string; referenceNo?: string }): Promise<{
    latestTransactionStatus: string;
    transactionStatusDesc?: string;
    paidTime?: string;
    paymentCode?: string;
    raw?: unknown;
  }> {
    if (config.isSandbox && (config.isTest || !config.dana.clientId || !config.dana.privateKey)) {
      return {
        latestTransactionStatus: "01",
        transactionStatusDesc: "INITIATED",
      };
    }

    try {
      const partnerReferenceNo = (params.externalId || "").slice(0, 25);
      const res = await withDanaTimeout(
        "queryPayment",
        getDanaPaymentGateway().queryPayment({
          merchantId: config.dana.merchantId || config.dana.clientId,
          originalPartnerReferenceNo: partnerReferenceNo,
          originalReferenceNo: params.referenceNo,
          serviceCode: "54",
        })
      );

      const paymentCode = res?.additionalInfo?.paymentViews?.[0]?.payOptionInfos?.[0]?.paymentCode;

      return {
        latestTransactionStatus: res.latestTransactionStatus,
        transactionStatusDesc: res.transactionStatusDesc,
        paidTime: res.paidTime,
        paymentCode,
        raw: res,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[DanaOrderService] queryOrderStatus error:", message);
      throw err;
    }
  }
}
