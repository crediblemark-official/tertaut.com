/**
 * Script: Test Production Transfer to Bank (DANA)
 *
 * Dipakai untuk menyelesaikan skenario "Successfully requests Transfer to Bank"
 * di tahap Production Testing DANA Enterprise.
 *
 * Jalankan dengan:
 *   bun scripts/test-production-transfer.ts
 *
 * ⚠️  Script ini melakukan transaksi NYATA ke production DANA.
 *     Pastikan saldo DANA merchant mencukupi sebelum menjalankan.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import Dana from "dana-node";

// ─── Load .env.production secara manual ───────────────────────────────────────
function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const content = readFileSync(path, "utf8");
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    result[key] = val;
  }
  return result;
}

function cleanPem(b64OrPem: string): string {
  if (b64OrPem.includes("-----BEGIN")) return b64OrPem.trim();
  try {
    return Buffer.from(b64OrPem, "base64").toString("utf8").trim();
  } catch {
    return b64OrPem.trim();
  }
}

const prodEnv = loadEnvFile(resolve(process.cwd(), ".env.production"));
const defaultEnv = loadEnvFile(resolve(process.cwd(), ".env"));
const env = { ...defaultEnv, ...prodEnv };

// ─── Kredensial Production ─────────────────────────────────────────────────────
const CLIENT_ID = env["DANA_CLIENT_ID"] || "";
const CLIENT_SECRET = env["DANA_CLIENT_SECRET"] || "";
const PRIVATE_KEY = cleanPem(env["DANA_PRIVATE_KEY_BASE64"] || "");
const rawCustomerNumber = env["DANA_CUSTOMER_NUMBER"] || "6285183131249";
const CUSTOMER_NUMBER = rawCustomerNumber.startsWith("0")
  ? `62${rawCustomerNumber.slice(1)}`
  : rawCustomerNumber;
const ORIGIN = env["PUBLIC_APP_URL"] || "https://tertaut.com";

// ─── Validasi ──────────────────────────────────────────────────────────────────
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🏦 DANA Production — Test Transfer to Bank");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

if (!CLIENT_ID || !CLIENT_SECRET || !PRIVATE_KEY || !CUSTOMER_NUMBER) {
  console.error("❌ Konfigurasi tidak lengkap:");
  console.error(`   DANA_CLIENT_ID          : ${CLIENT_ID ? "✅ ada" : "❌ KOSONG"}`);
  console.error(`   DANA_CLIENT_SECRET      : ${CLIENT_SECRET ? "✅ ada" : "❌ KOSONG"}`);
  console.error(`   DANA_PRIVATE_KEY_BASE64 : ${PRIVATE_KEY ? "✅ ada" : "❌ KOSONG"}`);
  console.error(
    `   DANA_CUSTOMER_NUMBER    : ${CUSTOMER_NUMBER ? "✅ " + CUSTOMER_NUMBER : "❌ KOSONG"}`
  );
  process.exit(1);
}

console.log(`   Client ID      : ${CLIENT_ID}`);
console.log(`   Customer No.   : ${CUSTOMER_NUMBER}`);
console.log(`   Origin         : ${ORIGIN}`);
console.log();

// ─── Dana SDK ─────────────────────────────────────────────────────────────────
const dana = new Dana({
  partnerId: CLIENT_ID,
  privateKey: PRIVATE_KEY,
  origin: ORIGIN,
  env: "production",
  clientSecret: CLIENT_SECRET,
});

// ─── Parameter Transfer ────────────────────────────────────────────────────────
// Jumlah minimum transfer bank: IDR 10.000 (atau lewat argumen CLI: bun script.ts 10000)
const cliAmount = process.argv[2] ? parseInt(process.argv[2], 10) : 10000;
const TRANSFER_AMOUNT = isNaN(cliAmount) ? 10000 : cliAmount;
const EXTERNAL_ID = `test-prod-transfer-${Date.now()}`;

// Rekening Bank Tujuan (PT Retas Lintas Batas - Bank OCBC)
// Kode Bank Indonesia / SNAP BI untuk Bank OCBC / OCBC NISP adalah '028'
const cliBankCode = process.argv[3] || "028";
const BENEFICIARY_BANK_CODE = cliBankCode;
const BENEFICIARY_ACCOUNT_NO = "693800120448";
const BENEFICIARY_ACCOUNT_NAME = "PT Retas Lintas Batas";

// ─── Jalankan Transfer ────────────────────────────────────────────────────────
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("📤 Mengirim request Transfer to Bank...");
console.log(`   External ID    : ${EXTERNAL_ID}`);
console.log(`   Amount         : IDR ${TRANSFER_AMOUNT.toLocaleString()}`);
console.log(`   Bank           : ${BENEFICIARY_BANK_CODE}`);
console.log(`   Account No.    : ${BENEFICIARY_ACCOUNT_NO}`);
console.log(`   Account Name   : ${BENEFICIARY_ACCOUNT_NAME}`);
console.log(`   Customer No.   : ${CUSTOMER_NUMBER}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

try {
  const response = await dana.disbursementApi.transferToBank({
    partnerReferenceNo: EXTERNAL_ID,
    customerNumber: CUSTOMER_NUMBER,
    accountType: "MERCHANT_DEPOSIT_ACCOUNT",
    beneficiaryAccountNumber: BENEFICIARY_ACCOUNT_NO,
    beneficiaryBankCode: BENEFICIARY_BANK_CODE,
    amount: {
      currency: "IDR",
      value: `${TRANSFER_AMOUNT.toFixed(2)}`,
    },
    additionalInfo: {
      fundType: "MERCHANT_WITHDRAW_FOR_CORPORATE",
      beneficiaryAccountName: BENEFICIARY_ACCOUNT_NAME,
      needNotify: false,
    },
  });

  const responseCode = (response as any)?.responseCode;
  console.log("✅ Response diterima dari DANA:");
  console.log(JSON.stringify(response, null, 2));

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (responseCode === "2004300" || responseCode === "2001800") {
    console.log("🎉 STATUS: SUCCESS — Transfer berhasil diproses!");
    console.log("   Cek dashboard DANA, skenario 'Transfer to Bank' seharusnya sudah ✅");
  } else if (responseCode === "2024300") {
    console.log("⏳ STATUS: PROCESSING — Transfer sedang diproses DANA.");
    console.log("   Tunggu webhook notifikasi atau cek dashboard DANA beberapa menit lagi.");
  } else {
    console.log(`⚠️  STATUS: Response Code = ${responseCode}`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("❌ Transfer gagal:", message);
  if (err && typeof err === "object") {
    if ("response" in err && (err as any).response) {
      try {
        const resp = (err as any).response;
        if (typeof resp.text === "function") {
          const text = await resp.text();
          console.error("   Response Body:", text);
        } else if (typeof resp.json === "function") {
          const json = await resp.json();
          console.error("   Response JSON:", JSON.stringify(json, null, 2));
        } else {
          console.error("   Response Object:", resp);
        }
      } catch (readErr) {
        console.error("   Could not read response body:", readErr);
      }
    }
  }
  process.exit(1);
}
