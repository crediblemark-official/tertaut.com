import QRCode from "qrcode";
import type {
  PaymentGatewayAdapter,
  CreateGatewayOrderParams,
  GatewayOrderResponse,
  GatewayStatusResponse,
  GatewayDisbursementParams,
  GatewayDisbursementResponse,
  MorBreakdown,
  GatewayChannelsResponse,
} from "./types";
import { config } from "../../../config";
import { calculateMor } from "../../../utils/payment";

const VA_PREFIXES: Record<string, string> = {
  BCA: "3901",
  MANDIRI: "88888",
  BNI: "8808",
  BRI: "12800",
  PERMATA: "8528",
  CIMB: "5919",
  BSI: "900",
};

/**
 * Tertaut Internal Sandbox Gateway Adapter
 * Mengelola simulasi pembayaran pengujian (testing) 100% di dalam Tertaut
 * tanpa bergantung pada akun sandbox vendor PG dan tanpa menembak gateway produksi.
 */
export class SandboxGatewayAdapter implements PaymentGatewayAdapter {
  readonly id = "sandbox" as const;
  readonly displayName = "Tertaut Sandbox (Simulasi)";

  calculateMor(amount: number): MorBreakdown {
    return calculateMor(amount, 5); // 5% fee platform, 95% net builder
  }

  async createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResponse> {
    const rail = (params.paymentRail || "va").toLowerCase();
    const bank = (params.vaBank || "BCA").toUpperCase();
    const outlet = (params.retailOutlet || "ALFAMART").toUpperCase();

    let paymentCode: string | undefined;
    let qrDataUrl: string | undefined;

    if (rail === "va") {
      const prefix = VA_PREFIXES[bank] || "3901";
      const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000);
      paymentCode = `${prefix}${randomDigits}`;
    } else if (rail === "qris") {
      const qrString = `00020101021226540014ID.TERTAUT.SANDBOX.TEST011893600911000000000002152026092100000000303UMI51440014ID.TERTAUT.SANDBOX.TEST0215202609210000000520457325303360540${Number(params.amount).toFixed(2)}5802ID5911Tertaut MoR Sandbox6007Jakarta61051234062330114${params.externalId}6304ABCD`;
      paymentCode = qrString;
      try {
        qrDataUrl = await QRCode.toDataURL(qrString, { width: 320, margin: 2 });
      } catch {}
    } else if (rail === "retail") {
      const shortOutlet = outlet.includes("INDO") ? "INDO" : "ALFA";
      paymentCode = `TT-${shortOutlet}-${Math.floor(10000000 + Math.random() * 90000000)}`;
    } else if (rail === "ewallet") {
      paymentCode = `08${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    } else {
      paymentCode = "4000 1234 5678 9010";
    }

    const appOrigin = (config.publicAppUrl || "https://tertaut.com").replace(/\/$/, "");
    const checkoutUrl = `${appOrigin}/pay?externalId=${params.externalId}&mode=sandbox`;

    return {
      orderId: `inv_sandbox_${Date.now()}`,
      checkoutUrl,
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      scenario: "API",
      paymentRail: rail,
      paymentCode,
      qrDataUrl,
      vaBank: bank,
      retailOutlet: outlet,
    };
  }

  async queryOrderStatus(_params: {
    externalId: string;
    referenceNo?: string;
  }): Promise<GatewayStatusResponse> {
    // Transaksi sandbox internal tidak pernah query ke remote gateway eksternal
    return {
      isPaid: false,
      isExpired: false,
      isFailed: false,
    };
  }

  async verifyWebhook(
    _headers: Record<string, string | undefined>,
    _body?: any,
    _requestPath?: string
  ): Promise<boolean> {
    return true;
  }

  async createDisbursement(
    params: GatewayDisbursementParams
  ): Promise<GatewayDisbursementResponse> {
    return {
      id: `disb_sandbox_${Date.now()}`,
      externalId: params.externalId,
      amount: params.amount,
      bankCode: params.bankCode,
      accountHolderName: params.accountHolderName,
      status: "COMPLETED",
    };
  }

  async getPaymentChannels(): Promise<GatewayChannelsResponse> {
    // Seluruh channel simulator aktif untuk keperluan pengujian builder
    return {
      channels: [
        {
          channelCode: "BCA",
          channelCategory: "VIRTUAL_ACCOUNT",
          isEnabled: true,
          name: "BCA Virtual Account (Sandbox)",
        },
        {
          channelCode: "MANDIRI",
          channelCategory: "VIRTUAL_ACCOUNT",
          isEnabled: true,
          name: "Mandiri Virtual Account (Sandbox)",
        },
        {
          channelCode: "BNI",
          channelCategory: "VIRTUAL_ACCOUNT",
          isEnabled: true,
          name: "BNI Virtual Account (Sandbox)",
        },
        {
          channelCode: "BRI",
          channelCategory: "VIRTUAL_ACCOUNT",
          isEnabled: true,
          name: "BRI Virtual Account (Sandbox)",
        },
        {
          channelCode: "PERMATA",
          channelCategory: "VIRTUAL_ACCOUNT",
          isEnabled: true,
          name: "Permata Virtual Account (Sandbox)",
        },
        {
          channelCode: "QRIS",
          channelCategory: "QRIS",
          isEnabled: true,
          name: "QRIS Instan (Sandbox)",
        },
        {
          channelCode: "ALFAMART",
          channelCategory: "RETAIL_OUTLET",
          isEnabled: true,
          name: "Alfamart (Sandbox)",
        },
        {
          channelCode: "INDOMARET",
          channelCategory: "RETAIL_OUTLET",
          isEnabled: true,
          name: "Indomaret (Sandbox)",
        },
        {
          channelCode: "DANA",
          channelCategory: "EWALLET",
          isEnabled: true,
          name: "DANA (Sandbox)",
        },
        {
          channelCode: "GOPAY",
          channelCategory: "EWALLET",
          isEnabled: true,
          name: "GoPay (Sandbox)",
        },
      ],
      activeRails: ["va", "qris", "retail", "ewallet", "card"],
      activeBanks: ["BCA", "MANDIRI", "BNI", "BRI", "PERMATA", "CIMB", "BSI"],
      activeEwallets: ["DANA", "GOPAY", "OVO", "SHOPEEPAY", "LINKAJA"],
      activeRetails: ["ALFAMART", "INDOMARET"],
      qrisEnabled: true,
      cardEnabled: true,
    };
  }
}

export const sandboxGateway = new SandboxGatewayAdapter();
