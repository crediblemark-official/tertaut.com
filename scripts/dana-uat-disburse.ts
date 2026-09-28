/**
 * DANA Sandbox Disbursement Mandatory UAT Test Runner
 *
 * Menjalankan 7 Skenario UAT Wajib "Dana Disbursement Bank Top Up" (POST /v1.0/emoney/transfer-bank.htm)
 * sesuai spesifikasi resmi DANA Sandbox (github.com/dana-id/uat-script)
 * agar diverifikasi otomatis oleh sistem DANA (7 of 7 completed).
 *
 * Jalankan dengan:
 *   bun run dana:uat-disburse
 */

import { config } from "../src/server/config";
import { getDanaDisbursementApi } from "../src/server/services/danaClient";
import { v4 as uuidv4 } from "uuid";

console.log("\n========================================================");
console.log("  DANA Enterprise Disburse to Bank UAT Test Suite       ");
console.log("========================================================\n");

const clientId = config.dana.clientId;
const merchantId = config.dana.merchantId;
// Akun deposit sandbox resmi DANA untuk UAT adalah 62811742234
const customerNumber = "62811742234";

console.log(`[Config] DANA Client ID   : ${clientId ? clientId.slice(0, 8) + "..." : "KOSONG"}`);
console.log(`[Config] DANA Merchant ID : ${merchantId || "KOSONG"}`);
console.log(`[Config] Customer Number  : ${customerNumber} (Sandbox Merchant Deposit Account)`);
console.log(`[Config] Base URL         : ${config.dana.baseUrl}\n`);

if (!clientId || !config.dana.privateKey) {
  console.error("❌ Kredensial DANA belum lengkap di .env (DANA_CLIENT_ID / DANA_PRIVATE_KEY).");
  process.exit(1);
}

const api = getDanaDisbursementApi();

type UatScenario = {
  id: number;
  name: string;
  expectedCodes: string[];
  run: () => Promise<any>;
};

const scenarios: UatScenario[] = [
  {
    id: 1,
    name: "Successfully requests Transfer to Bank (2004300 / 2024300)",
    expectedCodes: ["2004300", "2024300"],
    run: async () => {
      const ref = uuidv4();
      return await api.transferToBank({
        partnerReferenceNo: ref,
        customerNumber,
        beneficiaryAccountNumber: "2460888509",
        beneficiaryBankCode: "014",
        amount: {
          currency: "IDR",
          value: "50000.00",
        },
        additionalInfo: {
          fundType: "MERCHANT_WITHDRAW_FOR_CORPORATE",
          externalDivisionId: null,
          chargeTarget: null,
          needNotify: false,
          beneficiaryAccountName: null,
          accessToken: null,
        } as any,
      });
    },
  },
  {
    id: 2,
    name: "Transfer to Bank with Request In Progress (2024300)",
    expectedCodes: ["2024300", "2004300"],
    run: async () => {
      const ref = uuidv4();
      return await api.transferToBank({
        partnerReferenceNo: ref,
        customerNumber,
        beneficiaryAccountNumber: "2460888509",
        beneficiaryBankCode: "014",
        amount: {
          currency: "IDR",
          value: "50000.00",
        },
        additionalInfo: {
          fundType: "MERCHANT_WITHDRAW_FOR_CORPORATE",
          externalDivisionId: null,
          chargeTarget: null,
          needNotify: true,
          beneficiaryAccountName: null,
          accessToken: null,
        } as any,
      });
    },
  },
  {
    id: 3,
    name: "Error Inconsistent Request when transfer To Bank (4044318)",
    expectedCodes: ["4044318"],
    run: async () => {
      const duplicateRef = uuidv4();
      // Panggilan pertama valid
      try {
        await api.transferToBank({
          partnerReferenceNo: duplicateRef,
          customerNumber,
          beneficiaryAccountNumber: "2460888509",
          beneficiaryBankCode: "014",
          amount: { currency: "IDR", value: "50000.00" },
          additionalInfo: {
            fundType: "MERCHANT_WITHDRAW_FOR_CORPORATE",
            needNotify: false,
          } as any,
        });
      } catch {}

      // Panggilan kedua dengan partnerReferenceNo yang sama tetapi nominal berbeda
      return await api.transferToBank({
        partnerReferenceNo: duplicateRef,
        customerNumber,
        beneficiaryAccountNumber: "2460888509",
        beneficiaryBankCode: "014",
        amount: { currency: "IDR", value: "75000.00" },
        additionalInfo: {
          fundType: "MERCHANT_WITHDRAW_FOR_CORPORATE",
          needNotify: false,
        } as any,
      });
    },
  },
  {
    id: 4,
    name: "Error Insufficient Fund when Transfer to Bank (4034314)",
    expectedCodes: ["4034314"],
    run: async () => {
      const ref = uuidv4();
      return await api.transferToBank({
        partnerReferenceNo: ref,
        customerNumber,
        beneficiaryAccountNumber: "81298055129",
        beneficiaryBankCode: "014",
        amount: {
          currency: "IDR",
          value: "50000000000.00",
        },
        additionalInfo: {
          fundType: "MERCHANT_WITHDRAW_FOR_CORPORATE",
          externalDivisionId: null,
          chargeTarget: null,
          needNotify: null,
          beneficiaryAccountName: null,
          accessToken: null,
        } as any,
      });
    },
  },
  {
    id: 5,
    name: "Error Inactive Account when request Disbursement Top Up (4034318)",
    expectedCodes: ["4034318"],
    run: async () => {
      const ref = uuidv4();
      return await api.transferToBank({
        partnerReferenceNo: ref,
        customerNumber,
        beneficiaryAccountNumber: "81398055100",
        beneficiaryBankCode: "014",
        amount: {
          currency: "IDR",
          value: "50000.00",
        },
        additionalInfo: {
          fundType: "MERCHANT_WITHDRAW_FOR_CORPORATE",
          externalDivisionId: null,
          chargeTarget: null,
          needNotify: null,
          beneficiaryAccountName: null,
          accessToken: null,
        } as any,
      });
    },
  },
  {
    id: 6,
    name: "Invalid Field Format error when transfer To Bank (4004301)",
    expectedCodes: ["4004301", "5004301"],
    run: async () => {
      const ref = uuidv4();
      return await api.transferToBank({
        partnerReferenceNo: ref,
        customerNumber,
        beneficiaryAccountNumber: "2460888509",
        beneficiaryBankCode: "014",
        amount: {
          currency: "USD" as any, // Currency tidak valid (bukan IDR)
          value: "1000.00",
        },
        additionalInfo: {
          fundType: "MERCHANT_WITHDRAW_FOR_CORPORATE",
          externalDivisionId: null,
          chargeTarget: null,
          needNotify: null,
          beneficiaryAccountName: null,
          accessToken: null,
        } as any,
      });
    },
  },
  {
    id: 7,
    name: "Missing mandatory field error when transfer To Bank (4004302)",
    expectedCodes: ["4004302"],
    run: async () => {
      const res = await fetch(`${config.dana.baseUrl}/v1.0/emoney/transfer-bank.htm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PARTNER-ID": clientId,
          "CHANNEL-ID": `${clientId}-SERVER`,
          ORIGIN: config.dana.origin || "https://tertaut.com",
          "X-EXTERNAL-ID": "sdk" + uuidv4().substring(3),
          "X-TIMESTAMP": "",
          "X-SIGNATURE": "missing_timestamp_sig",
        },
        body: JSON.stringify({
          partnerReferenceNo: uuidv4(),
          customerNumber,
          beneficiaryAccountNumber: "2460888509",
          beneficiaryBankCode: "014",
          amount: { currency: "IDR", value: "100.00" },
        }),
      });
      return await res.json();
    },
  },
];

async function main() {
  let passed = 0;

  for (const s of scenarios) {
    process.stdout.write(`[Skenario ${s.id}/7] ${s.name} ... `);
    try {
      const res = await s.run();
      const code = String((res as any)?.responseCode || (res as any)?.status || "");
      if (s.expectedCodes.includes(code)) {
        console.log(`✅ OK (responseCode: ${code})`);
        passed++;
      } else {
        console.log(`ℹ️ Respons diterima: ${code} (Ekspektasi: ${s.expectedCodes.join("/")})`);
      }
    } catch (err: any) {
      const rawRes = err?.rawResponse;
      const code = String(rawRes?.responseCode || err?.response?.responseCode || err?.status || "");
      const msg = rawRes?.responseMessage || err?.message || String(err);

      if (s.expectedCodes.includes(code) || s.expectedCodes.some((exp) => msg.includes(exp))) {
        console.log(`✅ OK (DANA merespons expected code ${code}: "${msg.slice(0, 50)}")`);
        passed++;
      } else {
        console.log(
          `ℹ️ DANA merespons: code ${code || "HTTP " + err?.status} - ${msg.slice(0, 80)}`
        );
      }
    }
  }

  console.log("\n========================================================");
  console.log(`  Hasil: ${passed}/7 Skenario berhasil diverifikasi.`);
  console.log(`  Periksa status di Dashboard DANA:`);
  console.log(`  👉 https://dashboard.dana.id/sandbox/ (Testing Scenarios)`);
  console.log("========================================================\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
