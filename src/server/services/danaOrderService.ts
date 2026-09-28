import { config, cleanPemKey } from "../config";
import { randomBytes } from "crypto";
import QRCode from "qrcode";
import { db } from "../db";
import { platformSettings } from "../db/schema/settings";
import { inArray } from "drizzle-orm";
import {
  getDanaPaymentGateway,
  withDanaTimeout,
  CreateDanaOrderParams,
  DanaOrderResponse,
} from "./danaClient";

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
  static async createOrder(
    params: CreateDanaOrderParams,
    gateway?: { createOrder: (payload: any) => Promise<any> }
  ): Promise<DanaOrderResponse> {
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

    let clientId = config.dana.clientId;
    let clientSecret = config.dana.clientSecret;
    let merchantId = config.dana.merchantId;
    let danaEnv: "sandbox" | "production" = config.dana.env;
    let privateKey = config.dana.privateKey;

    try {
      const rows = await db.query.platformSettings.findMany({
        where: inArray(platformSettings.key, [
          "sandbox_mode",
          "dana_sandbox_client_id",
          "dana_sandbox_client_secret",
          "dana_sandbox_merchant_id",
        ]),
      });
      const settingsMap = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      const isSandbox = settingsMap.sandbox_mode !== "false";

      if (isSandbox) {
        danaEnv = "sandbox";
        clientId = settingsMap.dana_sandbox_client_id || config.dana.clientId;
        clientSecret =
          settingsMap.dana_sandbox_client_secret !== undefined
            ? settingsMap.dana_sandbox_client_secret
            : config.dana.clientSecret;
        merchantId = settingsMap.dana_sandbox_merchant_id || config.dana.merchantId;
      } else {
        danaEnv = "production";
        clientId = process.env.DANA_CLIENT_ID || config.dana.clientId;
        clientSecret =
          process.env.DANA_CLIENT_SECRET !== undefined
            ? process.env.DANA_CLIENT_SECRET
            : config.dana.clientSecret;
        merchantId = process.env.DANA_MERCHANT_ID || config.dana.merchantId;
        privateKey = process.env.DANA_PRIVATE_KEY
          ? cleanPemKey(process.env.DANA_PRIVATE_KEY)
          : config.dana.privateKey;
      }
    } catch {}

    if (!clientId || !privateKey) {
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
        merchantId: merchantId || clientId,
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

      if (rail === "qris" && scenario !== "REDIRECT") {
        createOrderPayload.externalStoreId =
          config.dana.externalStoreId ||
          process.env.DANA_EXTERNAL_STORE_ID ||
          merchantId ||
          "TERTAUT_STORE";
      }

      let response: any;
      const activeGateway =
        gateway ||
        getDanaPaymentGateway({
          partnerId: clientId,
          clientSecret,
          env: danaEnv,
          privateKey,
        });
      try {
        response = await withDanaTimeout(
          "createOrder",
          activeGateway.createOrder(createOrderPayload as any)
        );
      } catch (gatewayErr: unknown) {
        const gatewayMessage =
          gatewayErr instanceof Error ? gatewayErr.message : String(gatewayErr);

        // Kapan fallback ke order MOCK diizinkan:
        //
        //  - `allowMock: true`  → ya. Ini fitur demo aplikasi sandbox (produk).
        //  - non-produksi       → ya, sebagai kenyamanan developer yang belum
        //                         mengisi externalStoreId. Dulu ini otomatis,
        //                         sehingga kegagalan integrasi sandbox ikut
        //                         disamarkan jadi order "sukses".
        //  - produksi            → tidak pernah.
        //
        // `DANA_ALLOW_MOCK_FALLBACK=false` mematikan nyaman itu secara paksa.
        // Buang status HTTP yang tidak informatif supaya pesan DANA yang
        // sebenarnya (mis. "fill externalStoreId") tetap terbaca.
        throw new Error(
          `DANA Order Gagal: ${gatewayMessage} ` +
            `(pastikan externalStoreId/submerchant terisi di dashboard DANA sandbox)`
        );
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
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[DanaOrderService] dana-node SDK createOrder Error:", message);
      if (
        message.includes("Invalid private key format") ||
        message.includes("Failed to generate signature")
      ) {
        throw new Error(
          "Format DANA_PRIVATE_KEY di server tidak valid (harus berupa kunci RSA PEM yang diawali -----BEGIN PRIVATE KEY----- atau -----BEGIN RSA PRIVATE KEY-----)."
        );
      }
      throw err;
    }
  }

  /**
   * Cek status pembayaran ke gateway DANA (Inquiry / Status Sync)
   */
  static async queryOrderStatus(
    params: { externalId: string; referenceNo?: string },
    gateway?: { queryPayment: (payload: any) => Promise<any> }
  ): Promise<{
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
      const activeGateway = gateway || getDanaPaymentGateway();
      const res = await withDanaTimeout(
        "queryPayment",
        activeGateway.queryPayment({
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
