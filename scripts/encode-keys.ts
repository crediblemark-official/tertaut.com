import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * Script utilitas untuk mengubah file .pem lokal menjadi format single-line Base64.
 * Sangat direkomendasikan untuk Dokploy / Docker / Cloud 12-factor environment variables
 * agar tidak terjadi error pemenggalan newline / quotes.
 *
 * Penggunaan:
 *   bun scripts/encode-keys.ts
 */

const keyMappings = [
  { env: "DANA_PRIVATE_KEY_BASE64", file: "keys/dana_production_private.pem", desc: "DANA Production RSA Private Key" },
  { env: "DANA_PUBLIC_KEY_BASE64", file: "keys/dana_production_public.pem", desc: "DANA Production RSA Public Key" },
  { env: "DANA_SANDBOX_PRIVATE_KEY_BASE64", file: "keys/dana_sandbox_private.pem", desc: "DANA Sandbox RSA Private Key" },
  { env: "DANA_SANDBOX_PUBLIC_KEY_BASE64", file: "keys/dana_sandbox_public.pem", desc: "DANA Sandbox RSA Public Key" },
  { env: "LICENSE_SIGNING_PRIVATE_KEY_BASE64", file: "keys/license_signing_private.pem", desc: "Ed25519 License Token Private Key" },
];

console.log("==============================================================================");
console.log("🔑 Dokploy / Production Environment Variables (Base64 Single-Line Format)");
console.log("Salin variabel di bawah ke tab Environment Variables di dashboard Dokploy Anda:");
console.log("==============================================================================\n");

let foundAny = false;

for (const item of keyMappings) {
  const fullPath = resolve(process.cwd(), item.file);
  if (existsSync(fullPath)) {
    foundAny = true;
    const content = readFileSync(fullPath, "utf8").trim();
    const base64 = Buffer.from(content, "utf8").toString("base64");
    console.log(`# ${item.desc} (${item.file})`);
    console.log(`${item.env}=${base64}\n`);
  } else {
    console.log(`# [LEWATI] ${item.file} tidak ditemukan di komputer lokal.`);
  }
}

if (!foundAny) {
  console.log("⚠️  Tidak ada file kunci yang ditemukan di direktori ./keys/");
} else {
  console.log("==============================================================================");
  console.log("💡 Tips: Nilai di atas 100% aman dari pemenggalan newline di Dokploy / Docker!");
  console.log("==============================================================================");
}
