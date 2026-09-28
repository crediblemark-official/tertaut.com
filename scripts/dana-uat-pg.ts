/**
 * DANA Sandbox Payment Gateway Mandatory & Additional UAT Test Runner
 *
 * Menjalankan skenario UAT resmi Payment Gateway DANA (SNAP BI) sesuai dokumen:
 * "testing uat pg dana.md"
 *
 * Cakupan Endpoint:
 *   1. POST /payment-gateway/v1.0/debit/payment-host-to-host.htm (Create Order)
 *   2. POST /payment-gateway/v1.0/debit/status.htm (Debit Status)
 *   3. POST /payment-gateway/v1.0/debit/cancel.htm (Cancel Order)
 *   4. POST /payment-gateway/v1.0/debit/refund.htm (Refund Order)
 *
 * Jalankan dengan:
 *   bun run dana:uat:pg
 */

import { config } from "../src/server/config";
import { getDanaPaymentGateway } from "../src/server/services/danaClient";
import crypto from "crypto";

console.log("\n========================================================");
console.log("  DANA Enterprise Payment Gateway UAT Test Suite        ");
console.log("========================================================\n");

const clientId = config.dana.clientId;
const merchantId = config.dana.merchantId;
const privateKey = config.dana.privateKey;
const origin = config.dana.origin || "https://tertaut.com";
const baseUrl = config.dana.baseUrl || "https://api.sandbox.dana.id";
const externalStoreId =
  config.dana.externalStoreId || process.env.DANA_EXTERNAL_STORE_ID || "tertautstoreid";

console.log(`[Config] DANA Client ID     : ${clientId ? clientId.slice(0, 8) + "..." : "KOSONG"}`);
console.log(`[Config] DANA Merchant ID   : ${merchantId || "KOSONG"}`);
console.log(`[Config] External Store ID  : ${externalStoreId}`);
console.log(`[Config] Base URL           : ${baseUrl}\n`);

if (!clientId || !privateKey) {
  console.error("❌ Kredensial DANA belum lengkap di .env (DANA_CLIENT_ID / DANA_PRIVATE_KEY).");
  process.exit(1);
}

const api = getDanaPaymentGateway();

// Helper untuk generate signature SNAP BI
function getSignature(
  method: string,
  path: string,
  body: Record<string, unknown>,
  timestamp: string,
  customSig?: string
): string {
  if (customSig !== undefined) return customSig;
  const minified = JSON.stringify(body);
  const sha = crypto.createHash("sha256").update(minified).digest("hex").toLowerCase();
  const stringToSign = `${method}:${path}:${sha}:${timestamp}`;
  const signer = crypto.createSign("SHA256");
  signer.update(stringToSign);
  return signer.sign(privateKey, "base64");
}

function randStr(len = 20): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let res = "";
  for (let i = 0; i < len; i++) res += chars[Math.floor(Math.random() * chars.length)];
  return res;
}

async function rawPost(
  path: string,
  body: Record<string, unknown>,
  headersMod: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  const now = new Date();
  const offset = "+07:00";
  const timestamp =
    headersMod["X-TIMESTAMP"] !== undefined
      ? headersMod["X-TIMESTAMP"]
      : now.toISOString().substring(0, 19).replace("Z", "") + offset;

  const signature =
    headersMod["X-SIGNATURE"] !== undefined
      ? headersMod["X-SIGNATURE"]
      : getSignature("POST", path, body, timestamp);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-PARTNER-ID": clientId,
    "CHANNEL-ID": `${clientId}-SERVER`,
    ORIGIN: origin,
    "X-EXTERNAL-ID": "sdk" + randStr(20),
    "X-TIMESTAMP": timestamp,
    "X-SIGNATURE": signature,
    ...headersMod,
  };

  // Bersihkan header jika diset ke string kosong/null
  for (const k of Object.keys(headers)) {
    if (headersMod[k] === "") {
      delete headers[k];
    }
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
}

type UatScenario = {
  id: string;
  category: string;
  name: string;
  expectedCodes: string[];
  run: () => Promise<any>;
};

const scenarios: UatScenario[] = [
  // ─── 1. Payment Gateway Payment (Create Order) ──────────────────────────────
  {
    id: "PG-01",
    category: "Payment Host-to-Host",
    name: "Successfully requests Create Order (2005400)",
    expectedCodes: ["2005400"],
    run: async () => {
      const ref = "PO" + Date.now().toString().slice(-14);
      const validUpTo = new Date(Date.now() + 600000)
        .toISOString()
        .replace(/\.\d{3}/, "")
        .replace("Z", "+07:00");
      return await api.createOrder({
        partnerReferenceNo: ref,
        merchantId: merchantId || clientId,
        externalStoreId,
        amount: { value: "10000.00", currency: "IDR" },
        validUpTo,
        urlParams: [
          { url: "https://tertaut.com/pay/return", type: "PAY_RETURN", isDeeplink: "Y" },
          { url: "https://tertaut.com/webhook/dana/notify", type: "NOTIFICATION", isDeeplink: "Y" },
        ],
        additionalInfo: {
          order: {
            orderTitle: "Payment Gateway Order",
            scenario: "REDIRECT",
            merchantTransType: "SPECIAL_MOVIE",
          },
          mcc: "5732",
          envInfo: {
            sourcePlatform: "IPG",
            terminalType: "SYSTEM",
            orderTerminalType: "WEB",
          },
        } as any,
      });
    },
  },
  {
    id: "PG-02",
    category: "Payment Host-to-Host",
    name: "Missing Mandatory Field (4005402) - X-TIMESTAMP: null",
    expectedCodes: ["4005402"],
    run: async () => {
      const body = {
        partnerReferenceNo: "PO" + Date.now().toString().slice(-14),
        merchantId: merchantId || clientId,
        amount: { value: "10000.00", currency: "IDR" },
      };
      const res = await rawPost("/payment-gateway/v1.0/debit/payment-host-to-host.htm", body, {
        "X-TIMESTAMP": "",
      });
      return res.body;
    },
  },
  {
    id: "PG-03",
    category: "Payment Host-to-Host",
    name: "Invalid Field Format (4005401) - Invalid X-TIMESTAMP format",
    expectedCodes: ["4005401"],
    run: async () => {
      const body = {
        partnerReferenceNo: "PO" + Date.now().toString().slice(-14),
        merchantId: merchantId || clientId,
        amount: { value: "10000.00", currency: "IDR" },
      };
      const res = await rawPost("/payment-gateway/v1.0/debit/payment-host-to-host.htm", body, {
        "X-TIMESTAMP": "invalid-timestamp",
      });
      return res.body;
    },
  },
  {
    id: "PG-04",
    category: "Payment Host-to-Host",
    name: "Inconsistent Request (4045418) - Duplicate partnerReferenceNo with different amount",
    expectedCodes: ["4045418"],
    run: async () => {
      const duplicateRef = "PO" + Date.now().toString().slice(-14);
      const validUpTo = new Date(Date.now() + 600000)
        .toISOString()
        .replace(/\.\d{3}/, "")
        .replace("Z", "+07:00");
      const basePayload = {
        partnerReferenceNo: duplicateRef,
        merchantId: merchantId || clientId,
        externalStoreId,
        validUpTo,
        urlParams: [
          { url: "https://tertaut.com/pay/return", type: "PAY_RETURN", isDeeplink: "Y" },
          { url: "https://tertaut.com/webhook/dana/notify", type: "NOTIFICATION", isDeeplink: "Y" },
        ],
        additionalInfo: {
          order: { orderTitle: "Order", scenario: "REDIRECT" },
          mcc: "5732",
          envInfo: { sourcePlatform: "IPG", terminalType: "SYSTEM", orderTerminalType: "WEB" },
        } as any,
      };

      try {
        await api.createOrder({
          ...basePayload,
          amount: { value: "100000.00", currency: "IDR" },
        } as any);
      } catch {}

      return await api.createOrder({
        ...basePayload,
        amount: { value: "200000.00", currency: "IDR" },
      } as any);
    },
  },
  {
    id: "PG-05",
    category: "Payment Host-to-Host",
    name: "General unauthorized error (4015400) - Invalid Signature",
    expectedCodes: ["4015400", "5005401"],
    run: async () => {
      const body = {
        partnerReferenceNo: "PO" + Date.now().toString().slice(-14),
        merchantId: merchantId || clientId,
        amount: { value: "10000.00", currency: "IDR" },
      };
      const res = await rawPost("/payment-gateway/v1.0/debit/payment-host-to-host.htm", body, {
        "X-SIGNATURE": "invalid_signature",
      });
      return res.body;
    },
  },

  // ─── 2. Payment Gateway Debit Status ─────────────────────────────────────────
  {
    id: "ST-01",
    category: "Debit Status",
    name: "Invalid Mandatory Field (4005502) - Missing X-TIMESTAMP",
    expectedCodes: ["4005502"],
    run: async () => {
      const res = await rawPost(
        "/payment-gateway/v1.0/debit/status.htm",
        {
          originalPartnerReferenceNo: "PO" + Date.now().toString().slice(-14),
          serviceCode: "54",
        },
        { "X-TIMESTAMP": "" }
      );
      return res.body;
    },
  },
  {
    id: "ST-02",
    category: "Debit Status",
    name: "Invalid Field Format (4005501) - Invalid X-TIMESTAMP",
    expectedCodes: ["4005501"],
    run: async () => {
      const res = await rawPost(
        "/payment-gateway/v1.0/debit/status.htm",
        {
          originalPartnerReferenceNo: "PO" + Date.now().toString().slice(-14),
          serviceCode: "54",
        },
        { "X-TIMESTAMP": "invalid-timestamp" }
      );
      return res.body;
    },
  },
  {
    id: "ST-03",
    category: "Debit Status",
    name: "General Error Scenario (5005501) - serviceCode: AZ",
    expectedCodes: ["5005501"],
    run: async () => {
      const res = await rawPost("/payment-gateway/v1.0/debit/status.htm", {
        originalPartnerReferenceNo: "PO" + Date.now().toString().slice(-14),
        serviceCode: "AZ",
      });
      return res.body;
    },
  },

  // ─── 3. Payment Gateway Cancel Order ─────────────────────────────────────────
  {
    id: "CN-01",
    category: "Cancel Order",
    name: "Cancel in Progress (2025700)",
    expectedCodes: ["2025700"],
    run: async () => {
      return await api.cancelOrder({
        originalPartnerReferenceNo: "2025700",
        merchantId: merchantId || clientId,
        reason: "Network timeout",
      } as any);
    },
  },
  {
    id: "CN-02",
    category: "Cancel Order",
    name: "Transaction Not Permitted (4035705)",
    expectedCodes: ["4035705"],
    run: async () => {
      return await api.cancelOrder({
        originalPartnerReferenceNo: "4035705",
        merchantId: merchantId || clientId,
        reason: "Network timeout",
      } as any);
    },
  },
  {
    id: "CN-03",
    category: "Cancel Order",
    name: "Merchant Status Abnormal (4045708)",
    expectedCodes: ["4045708"],
    run: async () => {
      return await api.cancelOrder({
        originalPartnerReferenceNo: "4045708",
        merchantId: merchantId || clientId,
        reason: "Network timeout",
      } as any);
    },
  },
  {
    id: "CN-04",
    category: "Cancel Order",
    name: "Missing Mandatory Parameter (4005702)",
    expectedCodes: ["4005702"],
    run: async () => {
      const res = await rawPost(
        "/payment-gateway/v1.0/debit/cancel.htm",
        {
          originalPartnerReferenceNo: "PO" + Date.now().toString().slice(-14),
        },
        { "X-TIMESTAMP": "" }
      );
      return res.body;
    },
  },
  {
    id: "CN-05",
    category: "Cancel Order",
    name: "Exceed Cancel Window Time (4035700)",
    expectedCodes: ["4035700"],
    run: async () => {
      return await api.cancelOrder({
        originalPartnerReferenceNo: "4035700",
        merchantId: merchantId || clientId,
        reason: "Network timeout",
      } as any);
    },
  },
  {
    id: "CN-06",
    category: "Cancel Order",
    name: "Cancel Not Allowed by Agreement (4035715)",
    expectedCodes: ["4035715"],
    run: async () => {
      return await api.cancelOrder({
        originalPartnerReferenceNo: "4035715",
        merchantId: merchantId || clientId,
        reason: "Network timeout",
      } as any);
    },
  },
  {
    id: "CN-07",
    category: "Cancel Order",
    name: "Insufficient Merchant Balance (4035714)",
    expectedCodes: ["4035714"],
    run: async () => {
      return await api.cancelOrder({
        originalPartnerReferenceNo: "4035714",
        merchantId: merchantId || clientId,
        reason: "Network timeout",
      } as any);
    },
  },
  {
    id: "CN-08",
    category: "Cancel Order",
    name: "Timeout (5005701)",
    expectedCodes: ["5005701"],
    run: async () => {
      return await api.cancelOrder({
        originalPartnerReferenceNo: "5005701",
        merchantId: merchantId || clientId,
        reason: "Network timeout",
      } as any);
    },
  },

  // ─── 4. Payment Gateway Refund Order ─────────────────────────────────────────
  {
    id: "RF-01",
    category: "Refund Order",
    name: "Request In Progress (2025800)",
    expectedCodes: ["2025800"],
    run: async () => {
      const ref = "PO" + Date.now().toString().slice(-14);
      return await api.refundOrder({
        originalPartnerReferenceNo: ref,
        partnerRefundNo: ref,
        refundAmount: { value: "225800.00", currency: "IDR" },
        reason: "Customer request",
      } as any);
    },
  },
  {
    id: "RF-02",
    category: "Refund Order",
    name: "Refund Not Allowed by Agreement (4035815)",
    expectedCodes: ["4035815"],
    run: async () => {
      const ref = "PO" + Date.now().toString().slice(-14);
      return await api.refundOrder({
        originalPartnerReferenceNo: ref,
        partnerRefundNo: ref,
        refundAmount: { value: "435815.00", currency: "IDR" },
        reason: "Customer request",
      } as any);
    },
  },
  {
    id: "RF-03",
    category: "Refund Order",
    name: "Missing Mandatory Parameter (4005802)",
    expectedCodes: ["4005802"],
    run: async () => {
      const ref = "PO" + Date.now().toString().slice(-14);
      const res = await rawPost(
        "/payment-gateway/v1.0/debit/refund.htm",
        {
          originalPartnerReferenceNo: ref,
          partnerRefundNo: ref,
          refundAmount: { value: "1000.00", currency: "IDR" },
        },
        { "X-SIGNATURE": "" }
      );
      return res.body;
    },
  },
  {
    id: "RF-04",
    category: "Refund Order",
    name: "Insufficient Merchant Balance (4035814)",
    expectedCodes: ["4035814"],
    run: async () => {
      const ref = "PO" + Date.now().toString().slice(-14);
      return await api.refundOrder({
        originalPartnerReferenceNo: ref,
        partnerRefundNo: ref,
        refundAmount: { value: "435814.00", currency: "IDR" },
        reason: "Customer request",
      } as any);
    },
  },
  {
    id: "RF-05",
    category: "Refund Order",
    name: "Internal Server Error (5005801)",
    expectedCodes: ["5005801"],
    run: async () => {
      const ref = "PO" + Date.now().toString().slice(-14);
      return await api.refundOrder({
        originalPartnerReferenceNo: ref,
        partnerRefundNo: ref,
        refundAmount: { value: "505801.00", currency: "IDR" },
        reason: "Customer request",
      } as any);
    },
  },
  {
    id: "RF-06",
    category: "Refund Order",
    name: "Merchant Status Abnormal (4045808)",
    expectedCodes: ["4045808"],
    run: async () => {
      const ref = "PO" + Date.now().toString().slice(-14);
      return await api.refundOrder({
        originalPartnerReferenceNo: ref,
        partnerRefundNo: ref,
        refundAmount: { value: "445808.00", currency: "IDR" },
        reason: "Customer request",
      } as any);
    },
  },
];

async function main() {
  let passed = 0;
  let total = scenarios.length;

  console.log(`Menjalankan ${total} Skenario Payment Gateway UAT...\n`);

  for (const s of scenarios) {
    process.stdout.write(`[${s.id}] [${s.category}] ${s.name} ... `);
    try {
      const res = await s.run();
      const code = String(
        (res as any)?.responseCode ||
          (res as any)?.rawResponse?.responseCode ||
          (res as any)?.response?.responseCode ||
          ""
      );
      if (s.expectedCodes.includes(code)) {
        console.log(`✅ OK (${code})`);
        passed++;
      } else {
        console.log(`ℹ️ Respon: ${code || "ERROR/500"} (Ekspektasi: ${s.expectedCodes.join("/")})`);
      }
    } catch (err: any) {
      const code = String(
        err?.responseCode ||
          err?.rawResponse?.responseCode ||
          err?.response?.responseCode ||
          err?.status ||
          ""
      );
      if (s.expectedCodes.includes(code)) {
        console.log(`✅ OK (${code})`);
        passed++;
      } else {
        const msg = err?.message || err?.rawResponse?.responseMessage || String(err);
        console.log(`❌ Gagal: ${code || "ERROR"} - ${msg.slice(0, 70)}`);
      }
    }
  }

  console.log("\n========================================================");
  console.log(`  HASIL: ${passed} dari ${total} skenario UAT terverifikasi!`);
  console.log("========================================================\n");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
