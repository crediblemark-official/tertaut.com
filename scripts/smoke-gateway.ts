/**
 * Smoke test payment gateway — memanggil API SANDBOX ASLI.
 *
 * ⚠️ Bedakan ini dari test suite:
 *
 *   `bun test`         → memaksa mock (config.isTest). Memprove LOGIKA:
 *                         routing, guardrail mock-vs-live, penulisan DB,
 *                         penerbitan lisensi, webhook, split fee MoR.
 *                         TIDAK pernah menyentuh PG sungguhan.
 *
 *   script ini         → NODE_ENV=development sehingga config.isTest = false
 *                         dan seluruh jalur mock mati. Memprove KONEKSI:
 *                         apakah kredensial, signature, dan kontrak respons
 *                         kita benar-benar diterima sandbox PG.
 *
 * Dipakai saat mendaftarkan beberapa PG sekaligus: ini satu-satunya cara
 * Know apakah gateway benar-benar siap produksi, karena test suite secara
 * struktural tidak bisa mengukurnya.
 *
 * Semua panggilan memakai nominal kecil dan data berlabel test. PG sandbox
 * tidak memindahkan uang sungguhan.
 *
 * Usage:
 *   bun run smoke:gateway              # semua gateway
 *   bun run smoke:gateway dana xendit  # subset
 */

import { getPaymentGateway } from "../src/server/services/payments/gateways";
import { config } from "../src/server/config";
import { db } from "../src/server/db";
import { platformSettings } from "../src/server/db/schema/settings";
import { eq } from "drizzle-orm";
import type {
  PaymentGatewayAdapter,
  CreateGatewayOrderParams,
} from "../src/server/services/payments/gateways/types";

// Alat ini wajib melaporkan apa adanya. Di non-produksi, DANA normally
// memfallback ke order MOCK saat ditolak (kenyamanan developer yang belum
// mengisi externalStoreId). Kalau fallback itu menyala, smoke test akan
// melaporkan "sukses" untuk integrasi yang sebenarnya rusak — persis hal yang
// membuat 3 bug produksi lolos dari test suite.
process.env.DANA_ALLOW_MOCK_FALLBACK = "false";

const GATEWAYS = ["dana", "xendit", "xenithpay"] as const;
const TEST_AMOUNT = 10_000; // Rp 10.000 — nominal terkecil yang sah di semua PG
const stamp = () =>
  new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
const extId = (gw: string) => `SMOKE_${gw}_${stamp()}`;

const mask = (s?: string | null) => {
  const v = (s ?? "").trim();
  if (!v) return "— KOSONG —";
  return v.length <= 10 ? `${v.slice(0, 3)}…` : `${v.slice(0, 8)}…${v.slice(-4)}`;
};

type StepResult = { name: string; ok: boolean; detail: string; ms: number };

async function timed<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ step: StepResult; value?: T }> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return {
      step: { name, ok: true, detail: "", ms: Date.now() - t0 },
      value,
    };
  } catch (err: any) {
    const msg = String(err?.message || err)
      .replace(/\s+/g, " ")
      .slice(0, 220);
    return { step: { name, ok: false, detail: msg, ms: Date.now() - t0 } };
  }
}

async function reportCredentials(gw: string, adapter: PaymentGatewayAdapter) {
  const rows = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, "sandbox_mode"));
  const sandboxMode = rows[0]?.value !== "false";

  const keys: string[] = [];
  if (gw === "dana") {
    keys.push(`clientId    ${mask(config.dana.clientId)}`);
    keys.push(`merchantId  ${mask(config.dana.merchantId)}`);
    keys.push(`privateKey  ${config.dana.privateKey ? "✓ terpasang" : "— KOSONG —"}`);
    keys.push(`depositNo   ${mask(config.dana.customerNumber)}`);
    keys.push(`baseUrl     ${config.dana.baseUrl}`);
  } else if (gw === "xendit") {
    const k = await (adapter as any).getCredentials?.();
    keys.push(`secretKey   ${mask(k?.secretKey)}`);
    keys.push(`webhookTok  ${mask(k?.webhookToken)}`);
    keys.push(`baseUrl     https://api.xendit.co`);
  } else {
    const k = await (adapter as any).getCredentials?.();
    keys.push(`accessKey   ${mask(k?.accessKey)}`);
    keys.push(`secretKey   ${mask(k?.secretKey)}`);
    keys.push(`webhookSec  ${mask(k?.webhookSecret)}`);
    keys.push(`baseUrl     ${k?.baseUrl}`);
  }
  keys.push(`sandboxMode ${sandboxMode ? "true" : "FALSE (mode produksi!)"}`);
  return keys;
}

async function runOrderStep(adapter: PaymentGatewayAdapter, gw: string): Promise<StepResult> {
  const rail = gw === "dana" ? "qris" : "qris";
  const params: CreateGatewayOrderParams = {
    externalId: extId(gw),
    amount: TEST_AMOUNT,
    payerEmail: "smoke-test@tertaut.com",
    description: "tertaut.com gateway smoke test",
    returnUrl: "https://tertaut.com/checkout/success",
    finishRedirectUrl: "https://tertaut.com/checkout/success",
    paymentRail: rail,
    vaBank: gw === "xenithpay" ? "BNI" : "BCA",
  };

  const { step, value } = await timed("createOrder (sandbox nyata)", () =>
    adapter.createOrder(params)
  );
  if (!step.ok) return step;
  if (!value) {
    return { ...step, ok: false, detail: "tidak mengembalikan respons" };
  }
  step.detail = `orderId=${value.orderId} rail=${value.paymentRail ?? "-"} url=${String(
    value.checkoutUrl || "(custom UI)"
  ).slice(0, 70)}`;
  return step;
}

async function runStatusStep(
  adapter: PaymentGatewayAdapter,
  externalId: string
): Promise<StepResult> {
  const { step, value } = await timed("queryOrderStatus", () =>
    adapter.queryOrderStatus({ externalId })
  );
  if (!step.ok) return step;
  if (!value) return { ...step, ok: false, detail: "tidak mengembalikan respons" };
  step.detail = `isPaid=${value.isPaid} isExpired=${value.isExpired} isFailed=${value.isFailed}`;
  return step;
}

async function runDisburseStep(adapter: PaymentGatewayAdapter, gw: string): Promise<StepResult> {
  const { step, value } = await timed("createDisbursement (sandbox nyata)", () =>
    adapter.createDisbursement({
      externalId: extId(gw),
      amount: TEST_AMOUNT,
      bankCode: "BCA",
      accountNumber: "1234567890",
      accountHolderName: "TERTAUT SMOKE TEST",
      description: "tertaut.com disbursement smoke test",
    })
  );
  if (!step.ok) return step;
  if (!value) return { ...step, ok: false, detail: "tidak mengembalikan respons" };
  step.detail = `id=${value.id} status=${value.status}`;
  return step;
}

async function main() {
  const requested = process.argv.slice(2).filter((a) => GATEWAYS.includes(a as any));
  const targets = (requested.length ? requested : GATEWAYS) as readonly string[];

  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  SMOKE TEST GATEWAY — API SANDBOX ASLI (mock dimatikan)            ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log(`NODE_ENV        = ${process.env.NODE_ENV}`);
  console.log(
    `config.isTest   = ${config.isTest}   ${config.isTest ? "⚠ mock masih aktif" : "✓ mock mati"}`
  );
  console.log(`config.isProd   = ${config.isProd}`);
  console.log(`nominal tes     = Rp ${TEST_AMOUNT.toLocaleString("id-ID")}`);
  console.log(
    `mock fallback   = ${process.env.DANA_ALLOW_MOCK_FALLBACK} (harus "false" — mock tidak boleh menyamar)`
  );
  console.log();

  const summary: Array<{ gw: string; ok: number; total: number; verdict: string }> = [];

  for (const gw of targets) {
    const adapter = getPaymentGateway(gw);
    console.log(
      `─── ${adapter.displayName} (${adapter.id}) ${"─".repeat(Math.max(0, 50 - adapter.displayName.length))}`
    );

    for (const line of await reportCredentials(gw, adapter)) {
      console.log(`  kredensial  ${line}`);
    }

    const orderStep = await runOrderStep(adapter, gw);
    const steps: StepResult[] = [orderStep];

    if (orderStep.ok) {
      const externalId = extId(gw);
      steps.push(await runStatusStep(adapter, externalId));
      steps.push(await runDisburseStep(adapter, gw));
    } else {
      steps.push({
        name: "queryOrderStatus",
        ok: false,
        detail: "dilewati — createOrder gagal",
        ms: 0,
      });
      steps.push({
        name: "createDisbursement",
        ok: false,
        detail: "dilewati — createOrder gagal",
        ms: 0,
      });
    }

    console.log();
    for (const s of steps) {
      const icon = s.ok ? "✓" : "✗";
      console.log(`  ${icon} ${s.name.padEnd(32)} ${String(s.ms).padStart(5)}ms`);
      if (s.detail) console.log(`      ${s.ok ? "" : "↳ "}${s.detail}`);
    }

    const ok = steps.filter((s) => s.ok).length;
    const orderConnected = orderStep.ok;
    summary.push({
      gw: adapter.displayName,
      ok,
      total: steps.length,
      verdict: orderConnected
        ? ok === steps.length
          ? "TERHUBUNG & LENGKAP"
          : "TERHUBUNG (sebagian langkah gagal)"
        : "TIDAK TERHUBUNG",
    });
    console.log();
  }

  console.log("═══ RINGKASAN ═══");
  for (const s of summary) {
    const icon =
      s.verdict === "TERHUBUNG & LENGKAP" ? "✓" : s.verdict === "TIDAK TERHUBUNG" ? "✗" : "◐";
    console.log(`  ${icon} ${s.gw.padEnd(12)} ${String(s.ok)}/${s.total}  ${s.verdict}`);
  }
  console.log();
  console.log("Catatan: sandbox PG tidak memindahkan uang sungguhan.");
  console.log("Status pengesahan merchant (approval) TIDAK dapat diuji dari sini —");
  console.log("itu soal proses di sisi PG, bukan kode.");

  process.exit(summary.some((s) => s.verdict === "TIDAK TERHUBUNG") ? 1 : 0);
}

main().catch((err) => {
  console.error("Smoke test gagal dijalankan:", err);
  process.exit(1);
});
