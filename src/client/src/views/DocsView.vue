<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useClipboard } from "../composables/useClipboard";
import {
  Copy,
  Check,
  Sparkles,
  BookOpen,
  Code2,
  ShieldCheck,
  Zap,
  Globe,
  ExternalLink,
  Layers,
  Eye,
  EyeOff,
  RefreshCw,
  Lock,
  ArrowRight,
  Terminal,
} from "lucide-vue-next";

import { api } from "../lib/api";
import type { AppItem } from "../types/app";
import { dashboardEnv } from "../lib/environment";
import { useConfirm } from "../composables/useConfirm";

const copiedIndex = ref<number | null>(null);
const appsList = ref<AppItem[]>([]);
const selectedAppSlug = ref("");
const selectedWidgetType = ref<"verified" | "sales_counter" | "status">("verified");
const widgetCustomers = ref<number | null>(null);
const activeSnippetTab = ref<"hosted" | "custom" | "webhook" | "curl">("hosted");

const { copy: writeClipboard } = useClipboard();
let copyTimer: ReturnType<typeof setTimeout> | null = null;

const currentApp = computed(() => {
  return appsList.value.find((a) => a.slug === selectedAppSlug.value) || appsList.value[0] || null;
});

const currentAppId = computed(() => currentApp.value?.id || "app_devdocs_pro");
const currentAppPrice = computed(() => currentApp.value?.targetPrice || 150000);

const builderSecret = ref("");
const revealSecret = ref(false);
const rotatingSecret = ref(false);

const displayedSecretKey = computed(() => {
  const key = builderSecret.value || "tt_secret_live_7f8a9b0c1d2e3f4a5b6c7d8e";
  if (revealSecret.value) return key;
  if (key.length <= 14) return "•".repeat(24);
  return key.slice(0, 10) + "•".repeat(key.length - 14) + key.slice(-4);
});

const { confirm: confirmDialog } = useConfirm();
const feedbackMessage = ref<{ type: "success" | "error"; text: string } | null>(null);
function setFeedback(type: "success" | "error", text: string) {
  feedbackMessage.value = { type, text };
  setTimeout(() => {
    feedbackMessage.value = null;
  }, 4000);
}

async function loadBuilderSecret() {
  try {
    const res = await api.getBuilderMyself();
    if (res.success && res.builder?.secretApiKey) {
      builderSecret.value = res.builder.secretApiKey;
    }
  } catch {
    // fallback
  }
}

async function rotateBuilderSecret() {
  if (rotatingSecret.value) return;
  const confirmed = await confirmDialog({
    title: "Rotasi Secret API Key",
    message:
      "Rotasi Secret API Key akan membuat semua request server-to-server & verifikasi webhook dengan key lama gagal (401). Lanjutkan?",
    confirmText: "Ya, Rotasi Secret Key",
    variant: "danger",
  });
  if (!confirmed) return;
  rotatingSecret.value = true;
  try {
    const res = await api.rotateBuilderSecret();
    if (res.success && res.secretApiKey) {
      builderSecret.value = res.secretApiKey;
      revealSecret.value = true;
      setFeedback("success", "Secret API Key berhasil dirotasi!");
    } else {
      setFeedback("error", res.error || "Gagal merotasi Secret API Key.");
    }
  } catch {
    setFeedback("error", "Terjadi kesalahan saat merotasi Secret API Key.");
  } finally {
    rotatingSecret.value = false;
  }
}

async function loadWidgetSales() {
  if (!selectedAppSlug.value) return;
  try {
    const res = await fetch(`/api/v1/widgets/badge/${selectedAppSlug.value}`);
    if (!res.ok) {
      widgetCustomers.value = null;
      return;
    }
    const json = await res.json();
    widgetCustomers.value =
      typeof json?.data?.totalCustomers === "number" ? json.data.totalCustomers : null;
  } catch {
    widgetCustomers.value = null;
  }
}

async function loadApps() {
  try {
    const res = await api.getApps();
    appsList.value = res.apps || [];
    if (res.apps && res.apps.length > 0 && !selectedAppSlug.value) {
      selectedAppSlug.value = res.apps[0].slug;
    }
  } catch {
    // fallback
  }
  await loadWidgetSales();
}

onMounted(() => {
  loadApps();
  loadBuilderSecret();
});
watch(selectedAppSlug, loadWidgetSales);
watch(dashboardEnv, () => {
  selectedAppSlug.value = "";
  loadApps();
});

onUnmounted(() => {
  if (copyTimer) {
    clearTimeout(copyTimer);
    copyTimer = null;
  }
});

async function copyCode(text: string, index: number) {
  const ok = await writeClipboard(text);
  if (!ok) return;
  copiedIndex.value = index;
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    if (copiedIndex.value === index) copiedIndex.value = null;
    copyTimer = null;
  }, 2000);
}

const originUrl = computed(() => {
  return typeof window !== "undefined" ? window.location.origin : "https://tertaut.com";
});

// Snippet 1: Hosted Checkout
const hostedSnippet = computed(() => {
  return `// 1. Backend Anda (Node.js / Express / Next.js API Route)
import express from 'express';
const app = express();

app.post('/api/create-checkout', async (req, res) => {
  const response = await fetch('${originUrl.value}/api/v1/checkout/session', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${process.env.TERTAUT_SECRET_KEY}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      appId: '${currentAppId.value}',
      amount: ${currentAppPrice.value || 150000}, // Nominal pembayaran dinamis (IDR)
      customerEmail: req.body.email || 'customer@example.com',
      redirectUrl: 'https://mysaas.com/dashboard/billing/success' // Alamat redirect setelah bayar
    })
  });

  const data = await response.json();
  if (data.success && data.checkoutUrl) {
    // Redirect pelanggan ke halaman pembayaran resmi Tertaut
    return res.json({ checkoutUrl: data.checkoutUrl });
  }

  res.status(400).json({ error: data.error || 'Gagal menyiapkan checkout' });
});`;
});

// Snippet 2: Custom Checkout (Headless)
const customSnippet = computed(() => {
  return `// 2. Custom Checkout (Headless API - Render Langsung di UI SaaS Anda)
// Backend Anda meminta QRIS / VA langsung:
const response = await fetch('${originUrl.value}/api/v1/checkout/session', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.TERTAUT_SECRET_KEY}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    appId: '${currentAppId.value}',
    amount: ${currentAppPrice.value || 150000},
    customerEmail: 'customer@example.com',
    paymentRail: 'qris' // atau 'va' (BCA, BNI, BRI, Mandiri)
  })
});

const result = await response.json();
// Response berisi data pembayaran mentah:
// {
//   "success": true,
//   "transactionId": "tx_abc123",
//   "qrDataUrl": "data:image/png;base64,iVBORw0KGgo...", // Siap di-render di tag <img>
//   "paymentCode": "000201010212266...", // String QRIS standar nasional
//   "amount": ${currentAppPrice.value || 150000}
// }`;
});

// Snippet 3: Webhook HMAC
const webhookSnippet = computed(() => {
  return `// 3. Webhook Listener (Menerima Event payment.success)
import express from 'express';
import crypto from 'crypto';

const app = express();

// Gunakan express.raw() atau req.body teks mentah untuk verifikasi HMAC yang akurat
app.post('/api/webhooks/tertaut', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-tertaut-signature'];
  const secretKey = process.env.TERTAUT_SECRET_KEY; // tt_secret_...

  const expectedSignature = 'hmac-sha256=' + crypto
    .createHmac('sha256', secretKey)
    .update(req.body)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).send('Signature tidak valid');
  }

  const payload = JSON.parse(req.body.toString());
  if (payload.event === 'payment.success') {
    const { transactionId, appId, amount, customerEmail } = payload;
    console.log(\`✅ Pembayaran sukses Rp \${amount} untuk \${customerEmail}\`);
    // Berikan akses fitur / langganan ke user SaaS Anda
  }

  res.json({ received: true });
});`;
});

// Snippet 4: cURL
const curlSnippet = computed(() => {
  return `curl -X POST ${originUrl.value}/api/v1/checkout/session \\
  -H "Authorization: Bearer ${builderSecret.value || "tt_secret_..."}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "appId": "${currentAppId.value}",
    "amount": ${currentAppPrice.value || 150000},
    "customerEmail": "buyer@example.com",
    "redirectUrl": "https://mysaas.com/dashboard"
  }'`;
});

// AI Prompt Generator
const aiPromptCursor = computed(() => {
  return `Kamu adalah Senior Fullstack Engineer. Tugasmu adalah mengintegrasikan gateway pembayaran Tertaut (Merchant of Record) ke aplikasi SaaS ini.

Kredensial & Konfigurasi:
- Tertaut App ID: ${currentAppId.value}
- Tertaut Base URL: ${originUrl.value}
- Environment Variable: Simpan Secret API Key di .env sebagai TERTAUT_SECRET_KEY=tt_secret_...

Langkah Integrasi:
1. Endpoint Pembuatan Sesi Checkout:
   Panggil POST ${originUrl.value}/api/v1/checkout/session dengan:
   - Header Authorization: Bearer \${process.env.TERTAUT_SECRET_KEY}
   - Header Content-Type: application/json
   - Body JSON:
     {
       "appId": "${currentAppId.value}",
       "amount": 150000,
       "customerEmail": userEmail,
       "redirectUrl": window.location.origin + "/billing/success"
     }
2. Alur Pembayaran:
   - Jika Hosted Checkout: Arahkan pelanggan ke checkoutUrl yang dikembalikan API.
   - Jika Custom Checkout: Tampilkan qrDataUrl atau paymentCode langsung di modal aplikasi Anda.
3. Webhook Listener (POST /api/webhooks/tertaut):
   - Baca header "x-tertaut-signature" (format: hmac-sha256=<hex>).
   - Hitung HMAC-SHA256 dari raw body menggunakan TERTAUT_SECRET_KEY.
   - Saat payload.event === "payment.success", aktifkan paket / kuota user di database.
   - Return status 200 { received: true }.`;
});

const widgetEmbedScript = computed(() => {
  const host = typeof window !== "undefined" ? window.location.origin : "https://tertaut.com";
  return `<!-- Tertaut.com Verified Trust & Sales Badge -->
<script src="${host}/api/v1/widgets/embed.js" async><\/script>
<tertaut-badge app="${selectedAppSlug.value || "my-app"}" type="${selectedWidgetType.value}"></tertaut-badge>`;
});
</script>

<template>
  <div class="space-y-6 animate-fadeIn pt-4 sm:pt-5 md:pt-6 pb-16">
    <!-- Feedback Alert -->
    <div
      v-if="feedbackMessage"
      class="p-3 rounded-xl text-xs font-bold transition flex items-center justify-between"
      :class="
        feedbackMessage.type === 'success'
          ? 'bg-forest/10 border border-forest/20 text-forest'
          : 'bg-red-500/10 border border-red-500/20 text-red-600'
      "
    >
      <span>{{ feedbackMessage.text }}</span>
      <button @click="feedbackMessage = null" class="underline cursor-pointer ml-2">Tutup</button>
    </div>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <div
          class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-forest/10 border border-forest/25 text-forest text-[11px] font-bold mb-1.5"
        >
          <BookOpen class="w-3 h-3 text-forest" />
          <span>SaaS Payment Gateway (Merchant of Record)</span>
        </div>
        <h1 class="text-xl md:text-2xl font-extrabold text-jetblack tracking-tight">
          Dokumentasi Integrasi &amp; Kredensial API
        </h1>
        <p class="text-xs text-jetblack/60 max-w-2xl">
          Terima pembayaran QRIS, Virtual Account (BCA, Mandiri, BRI, BNI), dan E-Wallet di SaaS
          Anda tanpa repot mengurus izin PJP. Cukup gunakan App ID dan Secret API Key.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <a
          href="/api/v1/swagger"
          target="_blank"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-jetblack text-gold text-xs font-bold transition hover:bg-jetblack/90 shadow-sm"
        >
          <span>OpenAPI / Swagger</span>
          <ExternalLink class="w-3 h-3" />
        </a>
      </div>
    </div>

    <!-- App Selector -->
    <div
      v-if="appsList.length > 0"
      class="p-3.5 rounded-xl bg-white border border-jetblack/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
    >
      <div class="flex items-center gap-2">
        <Layers class="w-4 h-4 text-forest" />
        <div>
          <span class="text-xs font-bold text-jetblack block">Pilih Proyek SaaS Aktif:</span>
          <span class="text-[11px] text-jetblack/50"
            >Snippet kode di bawah otomatis menggunakan App ID proyek terpilih.</span
          >
        </div>
      </div>
      <div class="w-full sm:w-64">
        <select
          v-model="selectedAppSlug"
          class="w-full bg-jetblack/5 border border-jetblack/15 rounded-lg px-3 py-1.5 text-xs font-bold text-jetblack focus:outline-none focus:border-forest transition"
        >
          <option v-for="app in appsList" :key="app.id" :value="app.slug">
            {{ app.name }} ({{ app.id }})
          </option>
        </select>
      </div>
    </div>

    <!-- Credentials Section: App ID & Secret API Key -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- 1. App ID (Project Identifier) -->
      <div class="p-4 sm:p-5 rounded-2xl bg-white border border-jetblack/15 shadow-xs space-y-3">
        <div class="flex items-start justify-between gap-2">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <Layers class="w-4 h-4 text-forest" />
              <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
                App ID (Project Identifier)
              </h2>
            </div>
            <span
              class="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-forest/10 text-forest"
            >
              Publik • Per Proyek
            </span>
          </div>
          <button
            @click="copyCode(currentAppId, 1)"
            class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg btn-gold text-xs font-bold transition cursor-pointer shadow-xs"
          >
            <Check v-if="copiedIndex === 1" class="w-3.5 h-3.5 text-forest" />
            <Copy v-else class="w-3.5 h-3.5" />
            <span>{{ copiedIndex === 1 ? "Tersalin" : "Salin ID" }}</span>
          </button>
        </div>

        <div
          class="p-2.5 rounded-lg bg-jetblack font-mono text-sm font-bold text-gold border border-jetblack/20 select-all truncate"
        >
          {{ currentAppId }}
        </div>

        <p class="text-[11px] text-jetblack/60 leading-relaxed">
          Identitas unik proyek SaaS (<span class="font-bold text-jetblack">{{
            currentApp?.name || "Aplikasi"
          }}</span
          >). Dikirimkan di parameter
          <code class="font-mono text-[10px] bg-jetblack/5 px-1 py-0.5 rounded">appId</code> saat
          membuat sesi checkout.
        </p>
      </div>

      <!-- 2. Secret API Key (Backend S2S) -->
      <div
        class="p-4 sm:p-5 rounded-2xl bg-amber-50/50 border border-amber-200/80 shadow-xs space-y-3"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <Lock class="w-4 h-4 text-amber-700" />
              <h2 class="text-xs font-bold uppercase tracking-wider text-amber-900">
                Secret API Key (Backend S2S)
              </h2>
            </div>
            <span
              class="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200/80 text-amber-900"
            >
              Rahasia • Akun Developer
            </span>
          </div>

          <div class="flex items-center gap-1.5">
            <button
              @click="rotateBuilderSecret"
              :disabled="rotatingSecret || !builderSecret"
              class="p-1.5 rounded-lg bg-red-100 hover:bg-red-200/70 text-red-700 text-xs font-bold transition cursor-pointer disabled:opacity-40"
              title="Rotasi Secret Key"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="rotatingSecret ? 'animate-spin' : ''" />
            </button>
            <button
              @click="revealSecret = !revealSecret"
              class="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200/70 text-amber-900 text-xs font-bold transition cursor-pointer"
              title="Tampilkan / Sembunyikan"
            >
              <EyeOff v-if="revealSecret" class="w-3.5 h-3.5" />
              <Eye v-else class="w-3.5 h-3.5" />
            </button>
            <button
              @click="copyCode(builderSecret, 2)"
              class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-900 text-amber-50 hover:bg-amber-800 text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <Check v-if="copiedIndex === 2" class="w-3.5 h-3.5 text-forest" />
              <Copy v-else class="w-3.5 h-3.5" />
              <span>{{ copiedIndex === 2 ? "Tersalin" : "Salin" }}</span>
            </button>
          </div>
        </div>

        <div
          class="p-2.5 rounded-lg bg-white border border-amber-300 font-mono text-sm font-bold text-amber-950 select-all truncate"
        >
          {{ displayedSecretKey }}
        </div>

        <p class="text-[11px] text-amber-900/70 leading-relaxed">
          Kunci otentikasi server Anda (<code
            class="font-mono text-[10px] bg-amber-100 px-1 py-0.5 rounded"
            >Bearer tt_secret_...</code
          >). Dipakai untuk otentikasi API checkout dan memverifikasi HMAC signature webhook.
        </p>
      </div>
    </div>

    <!-- Interactive Integration Snippets -->
    <div class="p-5 sm:p-6 rounded-2xl bg-white border border-jetblack/15 shadow-xs space-y-4">
      <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-jetblack/10 pb-4"
      >
        <div>
          <h2 class="text-sm font-bold text-jetblack flex items-center gap-2">
            <Code2 class="w-4 h-4 text-forest" />
            Panduan Integrasi Kode
          </h2>
          <p class="text-xs text-jetblack/60">
            Pilih metode checkout yang sesuai dengan arsitektur produk SaaS Anda.
          </p>
        </div>

        <!-- Mode Tabs -->
        <div
          class="flex items-center gap-1 p-1 bg-jetblack/5 rounded-xl self-start md:self-auto overflow-x-auto max-w-full"
        >
          <button
            @click="activeSnippetTab = 'hosted'"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap"
            :class="
              activeSnippetTab === 'hosted'
                ? 'bg-white text-jetblack shadow-xs'
                : 'text-jetblack/60 hover:text-jetblack'
            "
          >
            1. Hosted Checkout
          </button>
          <button
            @click="activeSnippetTab = 'custom'"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap"
            :class="
              activeSnippetTab === 'custom'
                ? 'bg-white text-jetblack shadow-xs'
                : 'text-jetblack/60 hover:text-jetblack'
            "
          >
            2. Custom (Headless)
          </button>
          <button
            @click="activeSnippetTab = 'webhook'"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap"
            :class="
              activeSnippetTab === 'webhook'
                ? 'bg-white text-jetblack shadow-xs'
                : 'text-jetblack/60 hover:text-jetblack'
            "
          >
            3. Webhook (HMAC)
          </button>
          <button
            @click="activeSnippetTab = 'curl'"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap"
            :class="
              activeSnippetTab === 'curl'
                ? 'bg-white text-jetblack shadow-xs'
                : 'text-jetblack/60 hover:text-jetblack'
            "
          >
            4. cURL
          </button>
        </div>
      </div>

      <!-- Tab Content 1: Hosted Checkout -->
      <div v-if="activeSnippetTab === 'hosted'" class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-jetblack/70">
            Opsi A: Hosted Checkout (Redirect Pelanggan ke Halaman Resmi Tertaut)
          </span>
          <button
            @click="copyCode(hostedSnippet, 10)"
            class="text-xs font-bold text-gold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Check v-if="copiedIndex === 10" class="w-3.5 h-3.5 text-forest" />
            <Copy v-else class="w-3.5 h-3.5" />
            <span>{{ copiedIndex === 10 ? "Tersalin" : "Salin Kode" }}</span>
          </button>
        </div>
        <pre
          class="p-4 rounded-xl bg-jetblack font-mono text-xs text-white/90 overflow-x-auto border border-jetblack/20 leading-relaxed"
          >{{ hostedSnippet }}</pre>
        <p class="text-[11px] text-jetblack/60">
          Pelanggan akan diarahkan ke halaman pembayaran Tertaut yang sudah mendukung QRIS otomatis,
          Virtual Account, dan E-Wallet. Setelah sukses, pelanggan di-redirect ke
          <code class="font-mono text-[10px]">redirectUrl</code>.
        </p>
      </div>

      <!-- Tab Content 2: Custom Checkout (Headless) -->
      <div v-if="activeSnippetTab === 'custom'" class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-jetblack/70">
            Opsi B: Custom Checkout (Headless / Render Langsung di UI Anda)
          </span>
          <button
            @click="copyCode(customSnippet, 11)"
            class="text-xs font-bold text-gold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Check v-if="copiedIndex === 11" class="w-3.5 h-3.5 text-forest" />
            <Copy v-else class="w-3.5 h-3.5" />
            <span>{{ copiedIndex === 11 ? "Tersalin" : "Salin Kode" }}</span>
          </button>
        </div>
        <pre
          class="p-4 rounded-xl bg-jetblack font-mono text-xs text-white/90 overflow-x-auto border border-jetblack/20 leading-relaxed"
          >{{ customSnippet }}</pre>
        <p class="text-[11px] text-jetblack/60">
          Gunakan opsi ini jika Anda tidak ingin pengguna meninggalkan situs Anda. API mengembalikan
          raw QR base64 (<code class="font-mono text-[10px]">qrDataUrl</code>) dan kode bayar
          Virtual Account.
        </p>
      </div>

      <!-- Tab Content 3: Webhook HMAC -->
      <div v-if="activeSnippetTab === 'webhook'" class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-jetblack/70">
            Verifikasi Webhook Event (<code class="font-mono text-[10px]">payment.success</code>)
          </span>
          <button
            @click="copyCode(webhookSnippet, 12)"
            class="text-xs font-bold text-gold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Check v-if="copiedIndex === 12" class="w-3.5 h-3.5 text-forest" />
            <Copy v-else class="w-3.5 h-3.5" />
            <span>{{ copiedIndex === 12 ? "Tersalin" : "Salin Kode" }}</span>
          </button>
        </div>
        <pre
          class="p-4 rounded-xl bg-jetblack font-mono text-xs text-white/90 overflow-x-auto border border-jetblack/20 leading-relaxed"
          >{{ webhookSnippet }}</pre>
        <p class="text-[11px] text-jetblack/60">
          Server Tertaut menandatangani setiap webhook menggunakan HMAC-SHA256 pada header
          <code class="font-mono text-[10px]">X-Tertaut-Signature</code> dengan Secret API Key akun
          Anda.
        </p>
      </div>

      <!-- Tab Content 4: cURL -->
      <div v-if="activeSnippetTab === 'curl'" class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-jetblack/70">
            Panggilan Server-to-Server via Terminal (cURL)
          </span>
          <button
            @click="copyCode(curlSnippet, 13)"
            class="text-xs font-bold text-gold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Check v-if="copiedIndex === 13" class="w-3.5 h-3.5 text-forest" />
            <Copy v-else class="w-3.5 h-3.5" />
            <span>{{ copiedIndex === 13 ? "Tersalin" : "Salin cURL" }}</span>
          </button>
        </div>
        <pre
          class="p-4 rounded-xl bg-jetblack font-mono text-xs text-gold overflow-x-auto border border-jetblack/20 leading-relaxed whitespace-pre-wrap"
          >{{ curlSnippet }}</pre>
      </div>
    </div>

    <!-- Prompt-Ready Integration Generator (Cursor / Windsurf / Claude Code) -->
    <div class="p-5 sm:p-6 rounded-2xl bg-white border border-jetblack/15 shadow-xs space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div class="flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-gold" />
          <div>
            <h2 class="text-sm font-bold text-jetblack">
              Prompt-Ready AI Integration Generator (Cursor / Windsurf / v0 / Claude Code)
            </h2>
            <p class="text-[11px] text-jetblack/60">
              Salin dan tempelkan langsung ke coding assistant berbasis AI Anda untuk integrasi
              instan.
            </p>
          </div>
        </div>

        <button
          @click="copyCode(aiPromptCursor, 20)"
          class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg btn-gold text-xs font-bold transition shrink-0 cursor-pointer shadow-xs"
        >
          <Check v-if="copiedIndex === 20" class="w-3.5 h-3.5 text-forest" />
          <Copy v-else class="w-3.5 h-3.5" />
          <span>{{ copiedIndex === 20 ? "Tersalin!" : "Salin Prompt untuk AI" }}</span>
        </button>
      </div>

      <pre
        class="p-4 rounded-xl bg-jetblack font-mono text-xs text-white/90 overflow-x-auto border border-jetblack/20 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto"
        >{{ aiPromptCursor }}</pre>
    </div>

    <!-- Embeddable Badges & Social Proof Widgets Generator -->
    <div
      class="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-jetblack/10 border-t border-jetblack/10 pt-6"
    >
      <div class="pb-6 lg:pb-0 pr-0 lg:pr-6 space-y-3">
        <div class="flex items-center gap-2">
          <ShieldCheck class="w-4 h-4 text-forest" />
          <h2 class="text-sm font-bold text-jetblack">Generator Embeddable Widget &amp; Badges</h2>
        </div>
        <p class="text-xs text-jetblack/60">
          Pasang Social Proof &amp; Verified Merchant Badge langsung di landing page Anda tanpa
          merusak styling (Shadow DOM Encapsulation).
        </p>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-jetblack/70 mb-1">Pilih Tipe Widget</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                @click="selectedWidgetType = 'verified'"
                class="p-2 rounded-lg border font-bold text-center transition cursor-pointer"
                :class="
                  selectedWidgetType === 'verified'
                    ? 'bg-jetblack text-gold border-jetblack'
                    : 'border-jetblack/15 text-jetblack/70 hover:bg-jetblack/5'
                "
              >
                Verified Trust
              </button>
              <button
                @click="selectedWidgetType = 'sales_counter'"
                class="p-2 rounded-lg border font-bold text-center transition cursor-pointer"
                :class="
                  selectedWidgetType === 'sales_counter'
                    ? 'bg-jetblack text-gold border-jetblack'
                    : 'border-jetblack/15 text-jetblack/70 hover:bg-jetblack/5'
                "
              >
                Sales Counter
              </button>
              <button
                @click="selectedWidgetType = 'status'"
                class="p-2 rounded-lg border font-bold text-center transition cursor-pointer"
                :class="
                  selectedWidgetType === 'status'
                    ? 'bg-jetblack text-gold border-jetblack'
                    : 'border-jetblack/15 text-jetblack/70 hover:bg-jetblack/5'
                "
              >
                Live Status
              </button>
            </div>
          </div>

          <div>
            <label class="block font-bold text-jetblack/70 mb-1">Slug Aplikasi Anda</label>
            <input
              v-model="selectedAppSlug"
              type="text"
              placeholder="nama-slug-aplikasi"
              class="w-full bg-jetblack/5 border border-jetblack/10 rounded-lg p-2 font-mono text-xs text-jetblack focus:outline-none focus:bg-white focus:border-gold transition"
            />
          </div>

          <div class="space-y-1.5 pt-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-jetblack/70 text-[11px]">Kode HTML Embed:</span>
              <button
                @click="copyCode(widgetEmbedScript, 4)"
                class="text-[11px] font-bold text-gold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Check v-if="copiedIndex === 4" class="w-3 h-3 text-forest" />
                <Copy v-else class="w-3 h-3" />
                <span>{{ copiedIndex === 4 ? "Tersalin" : "Salin Snippet" }}</span>
              </button>
            </div>
            <pre
              class="p-2.5 rounded-lg bg-jetblack font-mono text-[11px] text-gold overflow-x-auto whitespace-pre-wrap leading-relaxed"
              >{{ widgetEmbedScript }}</pre>
          </div>
        </div>
      </div>

      <!-- Live Widget Preview -->
      <div class="pt-6 lg:pt-0 pl-0 lg:pl-6 space-y-4 flex flex-col justify-between">
        <div>
          <h2 class="text-sm font-bold text-jetblack">Pratinjau Widget (Live Preview)</h2>
          <p class="text-xs text-jetblack/60">Tampilan render di situs web pelanggan:</p>
        </div>

        <div
          class="h-40 flex flex-col items-center justify-center p-6 border border-dashed border-jetblack/20 rounded-xl bg-[#FAFAFA] space-y-3"
        >
          <!-- Verified Trust Preview -->
          <div
            v-if="selectedWidgetType === 'verified'"
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-jetblack text-white border border-gold/50 shadow-md text-xs font-bold cursor-pointer transition hover:scale-105"
          >
            <ShieldCheck class="w-3.5 h-3.5 text-gold" />
            <span>Verified by tertaut.com</span>
          </div>

          <!-- Sales Counter Preview -->
          <div
            v-else-if="selectedWidgetType === 'sales_counter'"
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-jetblack text-white border border-gold/50 shadow-md text-xs font-bold cursor-pointer transition hover:scale-105"
          >
            <span class="w-2 h-2 rounded-full bg-forest animate-ping"></span>
            <span>{{
              widgetCustomers === null
                ? "—"
                : `${widgetCustomers.toLocaleString("id-ID")} Transaksi Sukses`
            }}</span>
            <span class="opacity-30">•</span>
            <span class="text-gold">tertaut</span>
          </div>

          <!-- Status Indicator Preview -->
          <div
            v-else
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-jetblack text-white border border-gold/50 shadow-md text-xs font-bold cursor-pointer transition hover:scale-105"
          >
            <span class="w-2 h-2 rounded-full bg-forest"></span>
            <span>Live Merchant</span>
            <span class="opacity-30">•</span>
            <span class="text-gold">tertaut</span>
          </div>

          <p class="text-[10px] text-jetblack/50 text-center">
            Terisolasi di dalam Web Component Shadow DOM sehingga tidak merusak CSS situs Anda.
          </p>
        </div>

        <div
          class="text-[11px] text-jetblack/60 flex items-center justify-between border-t border-jetblack/10 pt-3"
        >
          <span>Tersedia juga format SVG statis:</span>
          <a
            :href="`/api/v1/badge/${selectedAppSlug}`"
            target="_blank"
            class="text-gold font-bold hover:underline flex items-center gap-1"
          >
            <span>/api/v1/badge/{{ selectedAppSlug }}.svg</span>
            <ExternalLink class="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
