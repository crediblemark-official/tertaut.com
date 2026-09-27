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

const envPath = resolve(process.cwd(), ".env.production");
const env = loadEnvFile(envPath);

// ─── Kredensial Production ─────────────────────────────────────────────────────
const CLIENT_ID = env["DANA_CLIENT_ID"] || "";
const CLIENT_SECRET = env["DANA_CLIENT_SECRET"] || "";
const PRIVATE_KEY = cleanPem(env["DANA_PRIVATE_KEY_BASE64"] || "");
const CUSTOMER_NUMBER = env["DANA_CUSTOMER_NUMBER"] || ""; // akun DANA merchant (628xxx)
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
// Jumlah minimum: IDR 1.000 (jumlah terkecil yang valid untuk test)
const TRANSFER_AMOUNT = 1000; // IDR
const EXTERNAL_ID = `test-prod-transfer-${Date.now()}`;

// ⬇️  GANTI dengan rekening bank milikmu sendiri untuk menerima transfer test
const BENEFICIARY_BANK_CODE = "BCA"; // Kode bank (BCA/BRI/BNI/MANDIRI/dll)
const BENEFICIARY_ACCOUNT_NO = "1234567890"; // ← GANTI nomor rekening tujuan
const BENEFICIARY_ACCOUNT_NAME = "Nama Pemilik"; // ← GANTI nama pemilik rekening

// ─── Guard: cegah jalankan dengan placeholder ─────────────────────────────────
if (BENEFICIARY_ACCOUNT_NO === "1234567890") {
  console.warn("⚠️  PERHATIAN: Nomor rekening masih placeholder!");
  console.warn("   Edit baris BENEFICIARY_ACCOUNT_NO dengan nomor rekening nyata.\n");
  process.exit(1);
}

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
    beneficiaryAccountNumber: BENEFICIARY_ACCOUNT_NO,
    beneficiaryBankCode: BENEFICIARY_BANK_CODE,
    amount: {
      currency: "IDR",
      value: `${TRANSFER_AMOUNT.toFixed(2)}`,
    },
    additionalInfo: {
      fundType: "1",
      beneficiaryName: BENEFICIARY_ACCOUNT_NAME,
      remark: "Production Testing - Transfer to Bank",
    } as any,
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
  if (err instanceof Error && (err as any).response) {
    console.error("   Response:", JSON.stringify((err as any).response?.data, null, 2));
  }
  process.exit(1);
}
