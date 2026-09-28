/**
 * DANA Sandbox Master UAT Test Runner
 *
 * Menjalankan seluruh pengujian UAT resmi DANA (Payment Gateway & Disbursement)
 * langsung ke server Sandbox DANA.
 *
 * Jalankan:
 *   bun run dana:uat            # Jalankan seluruh skenario (PG + Disburse)
 *   bun run dana:uat:pg         # Hanya Payment Gateway
 *   bun run dana:uat:disburse   # Hanya Disbursement Bank
 */

import { spawn } from "child_process";
import path from "path";

console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log("║           DANA ENTERPRISE SANDBOX UAT RUNNER               ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

function runScript(scriptPath: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("bun", [scriptPath], {
      stdio: "inherit",
      cwd: path.resolve(__dirname, ".."),
    });
    child.on("close", (code) => resolve(code || 0));
  });
}

async function main() {
  const arg = process.argv[2];

  if (arg === "pg") {
    await runScript(path.resolve(__dirname, "dana-uat-pg.ts"));
    return;
  }

  if (arg === "disburse") {
    await runScript(path.resolve(__dirname, "dana-uat-disburse.ts"));
    return;
  }

  console.log(">>> [1/2] Menjalankan Pengujian Payment Gateway UAT...\n");
  await runScript(path.resolve(__dirname, "dana-uat-pg.ts"));

  console.log("\n>>> [2/2] Menjalankan Pengujian Disbursement Bank UAT...\n");
  await runScript(path.resolve(__dirname, "dana-uat-disburse.ts"));

  console.log("\n========================================================");
  console.log("  Seluruh rangkaian pengujian UAT DANA selesai.");
  console.log("  Silakan periksa progress di Portal DANA Sandbox:");
  console.log("  👉 https://dashboard.dana.id/sandbox/");
  console.log("========================================================\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
