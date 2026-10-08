<script setup lang="ts">
import { ref } from "vue";
import { useClipboard } from "../../composables/useClipboard";
import { Check, Copy, ExternalLink } from "lucide-vue-next";

const { copy: writeClipboard } = useClipboard();

const activeCodeTab = ref<"license" | "aiproxy" | "checkout" | "metering">("license");
const copiedCode = ref(false);

const codeSnippets = {
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
  aiproxy: `import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({ appSlug: "chat-ai-suite" });

// Kirim prompt ke AI tanpa mengekspos OpenAI / Anthropic API Key di klien!
const response = await tertaut.aiProxy.chat({
  licenseKey: "TT-AI-5512-8890",
  messages: [
    { role: "user", content: "Buat ringkasan laporan keuangan ini..." }
  ],
  model: "gpt-4o", // otomatis diproteksi rate limit & daily token cap
});

console.log("Hasil AI:", response.choices[0].message.content);`,
  checkout: `import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({ appSlug: "desktop-pro" });

// Buka sesi checkout berbayar instan (QRIS & Virtual Account)
const session = await tertaut.checkout.createSession({
  productSlug: "lifetime-license",
  customerEmail: "pembeli@perusahaan.com",
  couponCode: "EARLYBIRD20",
});

// Arahkan pembeli ke halaman checkout aman Tertaut
window.location.href = session.checkoutUrl;`,
  metering: `import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({ appSlug: "saas-automate" });

// Laporkan konsumsi kredit penggunaan (usage-based billing)
await tertaut.credits.reportUsage({
  licenseKey: "TT-PRO-9821-4412",
  units: 5,
  feature: "export_pdf_hd",
  metadata: { pages: 12 },
});

const balance = await tertaut.credits.balance("TT-PRO-9821-4412");
console.log("Sisa kredit lisensi:", balance.remainingCredits);`,
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
  <section id="integrasi-sdk" class="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
    <div class="text-center space-y-3 max-w-2xl mx-auto">
      <h2 class="text-xs font-bold uppercase tracking-widest text-forest font-mono">
        Developer First SDK
      </h2>
      <h3 class="text-2xl sm:text-3xl font-extrabold text-jetblack tracking-tight">
        Integrasi Selesai Hanya dalam Hitungan Menit
      </h3>
      <p class="text-xs sm:text-sm text-jetblack/65">
        SDK resmi <code>@tertaut/sdk</code> berbobot kurang dari 15 KB, tanpa external dependencies,
        dan siap dipakai di Node.js, Bun, Browser, Tauri, maupun Electron.
      </p>
    </div>

    <div class="max-w-4xl mx-auto">
      <div
        class="rounded-2xl bg-jetblack text-white border border-white/10 shadow-2xl overflow-hidden"
      >
        <!-- Code Tabs Header -->
        <div
          class="flex flex-wrap items-center justify-between px-4 py-3 border-b border-white/10 bg-[#161616]"
        >
          <div class="flex items-center gap-2 overflow-x-auto">
            <button
              @click="activeCodeTab = 'license'"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer',
                activeCodeTab === 'license'
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:text-white',
              ]"
            >
              1. Validasi Lisensi
            </button>
            <button
              @click="activeCodeTab = 'aiproxy'"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer',
                activeCodeTab === 'aiproxy'
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:text-white',
              ]"
            >
              2. Panggil AI Gateway
            </button>
            <button
              @click="activeCodeTab = 'checkout'"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer',
                activeCodeTab === 'checkout'
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:text-white',
              ]"
            >
              3. Buka Sesi Checkout
            </button>
            <button
              @click="activeCodeTab = 'metering'"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer',
                activeCodeTab === 'metering'
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:text-white',
              ]"
            >
              4. Metered Billing
            </button>
          </div>

          <button
            @click="copyActiveCode"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-mono hover:bg-white/20 transition cursor-pointer"
          >
            <Check v-if="copiedCode" class="w-3.5 h-3.5 text-forest" />
            <Copy v-else class="w-3.5 h-3.5 text-gold" />
            <span>{{ copiedCode ? "Tersalin!" : "Salin Kode" }}</span>
          </button>
        </div>

        <!-- Code Display -->
        <div
          class="p-5 sm:p-6 overflow-x-auto font-mono text-xs text-white/90 leading-relaxed bg-[#0F0F0F]"
        >
          <pre><code>{{ codeSnippets[activeCodeTab] }}</code></pre>
        </div>

        <!-- Code Footer Bar -->
        <div
          class="px-5 py-3 border-t border-white/10 bg-[#141414] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div class="flex items-center gap-2 text-white/60 font-mono text-[11px]">
            <span class="w-2 h-2 rounded-full bg-forest"></span>
            <span>npm install @tertaut/sdk</span>
            <span>•</span>
            <span>Full TypeScript Definition (.d.ts) included</span>
          </div>
          <router-link
            to="/dashboard/docs"
            class="text-gold font-bold hover:underline inline-flex items-center gap-1"
          >
            <span>Buka Dokumentasi API Penuh</span>
            <ExternalLink class="w-3.5 h-3.5" />
          </router-link>
        </div>
      </div>
    </div>
  </section>
</template>
