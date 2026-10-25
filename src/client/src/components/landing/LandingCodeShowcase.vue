<script setup lang="ts">
import { ref } from "vue";
import { useClipboard } from "../../composables/useClipboard";
import { Check, Copy, ExternalLink } from "lucide-vue-next";

const { copy: writeClipboard } = useClipboard();

const activeCodeTab = ref<"license" | "webhook" | "checkout" | "floating">("checkout");
const copiedCode = ref(false);

const codeSnippets = {
  checkout: `import { Tertaut } from "@tertaut/sdk";

// Inisialisasi dengan Secret Key di backend SaaS Anda
const tertaut = new Tertaut({ secretKey: process.env.TERTAUT_SECRET_KEY });

// Buat sesi pembayaran dengan nominal dinamis dari kode SaaS
const session = await tertaut.checkout.createSession({
  appId: "app_fastmail_01",
  orderId: "INV-2026-901",
  amount: 135000, // Rp 135.000 (misal: 3 seats x Rp 45.000)
  customerEmail: "budi@perusahaan.com",
  paymentRail: "qris",
});

// Kembalikan qrString / checkoutUrl ke frontend web SaaS Anda
console.log("QRIS String:", session.qrString);`,
  webhook: `import crypto from "crypto";

// Verifikasi keaslian webhook pembayaran dari server Tertaut
export function verifyTertautWebhook(rawBody, signatureHeader, secretKey) {
  const [tPart, v1Part] = signatureHeader.split(",");
  const timestamp = tPart?.replace("t=", "");
  const signature = v1Part?.replace("v1=", "");
  
  if (!timestamp || !signature) return false;

  const signed = \`\${timestamp}.\${rawBody}\`;
  const expected = crypto.createHmac("sha256", secretKey).update(signed).digest("hex");
  
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}`,
  license: `import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({ appSlug: "desktop-pro" });

// Validasi lisensi dengan fallback Ed25519 token offline (hingga 30 hari tanpa internet)
const result = await tertaut.licensing.check({
  licenseKey: "TT-PRO-9821-4412",
  hwid: "macbook-pro-m2-hash",
});

if (result.valid) {
  console.log("Lisensi aktif untuk:", result.customerName);
  console.log("Device seat terpakai: 1 / 3");
}`,
  floating: `import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({
  apiKey: "tt_live_...",
  appId: "desktop-pro",
  baseUrl: "https://tertaut.com",
});

// Kirim heartbeat berkala (rolling lease) untuk floating license
const res = await tertaut.licensing.heartbeat({
  licenseKey: "TT-PRO-9821-4412",
  hwid: "macbook-pro-m2-hash",
  leaseKey: "lease_99a8b7c6",
});

console.log("Lease valid:", res.valid, "Perpanjangan TTL aktif!");`,
};

function copyActiveCode() {
  writeClipboard(codeSnippets[activeCodeTab.value]);
  copiedCode.value = true;
  setTimeout(() => {
    copiedCode.value = false;
  }, 2000);
}
</script>

<template>
  <section
    id="integrasi-sdk"
    class="py-10 sm:py-16 md:py-24 max-w-7xl mx-auto px-3.5 sm:px-6 space-y-8 sm:space-y-12 w-full min-w-0"
  >
    <div class="text-center space-y-2.5 sm:space-y-3 max-w-2xl mx-auto px-1 sm:px-0">
      <h2 class="text-xs font-bold uppercase tracking-widest text-forest font-mono">
        Developer First SDK
      </h2>
      <h3
        class="text-xl sm:text-2xl md:text-3xl font-extrabold text-jetblack tracking-tight leading-snug"
      >
        Integrasi Selesai Hanya dalam Hitungan Menit
      </h3>
      <p class="text-xs sm:text-sm text-jetblack/65">
        SDK resmi <code>@tertaut/sdk</code> berbobot kurang dari 15 KB, tanpa external dependencies,
        dan siap dipakai di Node.js, Bun, Browser, Tauri, maupun Electron.
      </p>
    </div>

    <div class="max-w-4xl mx-auto w-full min-w-0">
      <div
        class="rounded-2xl bg-jetblack text-white border border-white/10 shadow-2xl overflow-hidden w-full min-w-0"
      >
        <!-- Code Tabs Header (Touch & Mobile Scroll Optimized) -->
        <div
          class="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/10 bg-[#161616] w-full min-w-0"
        >
          <div
            class="flex items-center gap-1.5 sm:gap-2 overflow-x-auto min-w-0 py-0.5 flex-1 max-w-[calc(100%-75px)] sm:max-w-none no-scrollbar"
          >
            <button
              @click="activeCodeTab = 'checkout'"
              :class="[
                'px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-mono font-semibold transition cursor-pointer whitespace-nowrap shrink-0 active:scale-95',
                activeCodeTab === 'checkout'
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:text-white',
              ]"
            >
              1. Dynamic Checkout
            </button>
            <button
              @click="activeCodeTab = 'webhook'"
              :class="[
                'px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-mono font-semibold transition cursor-pointer whitespace-nowrap shrink-0 active:scale-95',
                activeCodeTab === 'webhook'
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:text-white',
              ]"
            >
              2. Verifikasi Webhook
            </button>
            <button
              @click="activeCodeTab = 'license'"
              :class="[
                'px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-mono font-semibold transition cursor-pointer whitespace-nowrap shrink-0 active:scale-95',
                activeCodeTab === 'license'
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:text-white',
              ]"
            >
              3. Validasi Lisensi
            </button>
            <button
              @click="activeCodeTab = 'floating'"
              :class="[
                'px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-mono font-semibold transition cursor-pointer whitespace-nowrap shrink-0 active:scale-95',
                activeCodeTab === 'floating'
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:text-white',
              ]"
            >
              4. Floating Lease
            </button>
          </div>

          <button
            @click="copyActiveCode"
            class="shrink-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/10 text-white text-[11px] sm:text-xs font-mono hover:bg-white/20 transition cursor-pointer active:scale-95"
            aria-label="Salin Kode"
          >
            <Check v-if="copiedCode" class="w-3.5 h-3.5 text-forest" />
            <Copy v-else class="w-3.5 h-3.5 text-gold" />
            <span class="hidden sm:inline">{{ copiedCode ? "Tersalin!" : "Salin Kode" }}</span>
            <span class="sm:hidden">{{ copiedCode ? "Tersalin!" : "Salin" }}</span>
          </button>
        </div>

        <!-- Code Display -->
        <div
          class="p-4 sm:p-6 overflow-x-auto font-mono text-[11px] sm:text-xs text-white/90 leading-relaxed bg-[#0F0F0F] w-full min-w-0"
        >
          <pre class="w-full min-w-0"><code>{{ codeSnippets[activeCodeTab] }}</code></pre>
        </div>

        <!-- Code Footer Bar -->
        <div
          class="px-4 sm:px-5 py-3 border-t border-white/10 bg-[#141414] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-xs w-full min-w-0"
        >
          <div
            class="flex flex-wrap items-center gap-x-2 gap-y-1 text-white/60 font-mono text-[10px] sm:text-[11px]"
          >
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-forest"></span>
              <span>npm install @tertaut/sdk</span>
            </span>
            <span class="text-white/30">•</span>
            <span>Full TypeScript .d.ts included</span>
          </div>
          <router-link
            to="/dashboard/docs"
            class="text-gold font-bold hover:underline inline-flex items-center gap-1 text-[11px] sm:text-xs pt-1 sm:pt-0"
          >
            <span>Buka Dokumentasi API Penuh</span>
            <ExternalLink class="w-3.5 h-3.5" />
          </router-link>
        </div>
      </div>
    </div>
  </section>
</template>
