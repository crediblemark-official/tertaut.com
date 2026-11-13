<script setup lang="ts">
import { ref } from "vue";
import type { PlatformSettingsFormData } from "../../../types/panel";
import { api } from "../../../lib/api";
import {
  Save,
  CreditCard,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  QrCode,
  Landmark,
  Store,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-vue-next";

defineProps<{
  form: PlatformSettingsFormData;
  saving: boolean;
}>();

const emit = defineEmits<{
  (e: "save"): void;
}>();

const copiedWebhook = ref(false);
const copiedXenditDemo = ref(false);

const syncingChannels = ref(false);
const syncResult = ref<{
  success: boolean;
  message?: string;
  error?: string;
  timestamp?: string;
} | null>(null);

function getAppOrigin() {
  return window.location.origin.includes("localhost")
    ? window.location.origin
    : "https://tertaut.com";
}

function copyXenditDemoUrl() {
  const url = `${getAppOrigin()}/demo/checkout/fastmail-ai?gateway=xendit`;
  navigator.clipboard.writeText(url);
  copiedXenditDemo.value = true;
  setTimeout(() => (copiedXenditDemo.value = false), 2000);
}

function copyWebhookUrl() {
  const origin = window.location.origin.includes("localhost")
    ? "https://tertaut.com"
    : window.location.origin;
  const url = `${origin}/api/v1/webhook/xendit`;
  navigator.clipboard.writeText(url);
  copiedWebhook.value = true;
  setTimeout(() => {
    copiedWebhook.value = false;
  }, 2000);
}

async function handleSyncChannels() {
  syncingChannels.value = true;
  syncResult.value = null;
  try {
    const res = await api.syncPaymentChannels();
    if (res.success) {
      syncResult.value = {
        success: true,
        message:
          res.qrisProbe?.message ||
          "Channel pembayaran resmi Xendit Live aktif (QRIS Instan, 7 Bank VA, Indomaret).",
        timestamp: new Date().toLocaleTimeString("id-ID"),
      };
    } else {
      syncResult.value = {
        success: false,
        error: res.error || "Gagal menghubungi API Xendit untuk sinkronisasi channel.",
        timestamp: new Date().toLocaleTimeString("id-ID"),
      };
    }
  } catch (err: any) {
    syncResult.value = {
      success: false,
      error: err.message || "Terjadi kesalahan saat sinkronisasi channel.",
      timestamp: new Date().toLocaleTimeString("id-ID"),
    };
  } finally {
    syncingChannels.value = false;
  }
}
</script>

<template>
  <div
    class="-mx-3.5 sm:-mx-4 md:-mx-6 divide-y divide-jetblack/10 border-b border-jetblack/10 animate-fadeIn"
  >
    <!-- SECTION 1: INTEGRASI & RAIL XENDIT -->
    <section class="divide-y divide-jetblack/10">
      <div
        class="px-3.5 sm:px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
      >
        <div>
          <h2
            class="text-xs font-bold uppercase tracking-wider text-jetblack flex items-center gap-2"
          >
            <CreditCard class="w-3.5 h-3.5 text-gold" />
            <span>Integrasi &amp; Rail Xendit</span>
          </h2>
          <p class="text-[11px] text-jetblack/60 mt-0.5">
            Xendit adalah payment rail tunggal platform Tertaut (MoR terpusat). Kredensial API
            dikelola aman di .env server.
          </p>
        </div>
        <span class="text-[11px] font-bold text-forest font-mono uppercase shrink-0">
          Rail: {{ (form.active_payment_gateway || "xendit").toUpperCase() }}
        </span>
      </div>

      <!-- Rail Provider Status Strip -->
      <div
        class="px-3.5 sm:px-4 md:px-6 py-3.5 bg-jetblack/[0.015] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div class="flex items-start gap-3">
          <CreditCard class="w-4 h-4 text-forest shrink-0 mt-0.5" />
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-jetblack">Xendit Indonesia</span>
              <span class="text-[10px] font-mono text-forest font-bold uppercase tracking-wider">
                Default MoR Rail
              </span>
            </div>
            <p class="text-[11px] text-jetblack/60 mt-0.5">
              Payment Rail resmi: QRIS Realtime, Mandiri, BCA, BRI, BNI, Permata, BSI, dan Gerai
              Retail.
            </p>
          </div>
        </div>
        <span class="text-xs font-semibold text-forest inline-flex items-center gap-1.5 shrink-0">
          <CheckCircle2 class="w-3.5 h-3.5 text-forest" />
          <span>Rail Aktif</span>
        </span>
      </div>

      <!-- Webhook URL Row -->
      <div
        class="px-3.5 sm:px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-jetblack/55 font-semibold shrink-0">Webhook URL:</span>
          <code class="font-mono font-bold text-jetblack text-[11px] truncate"
            >https://tertaut.com/api/v1/webhook/xendit</code
          >
        </div>
        <button
          type="button"
          @click="copyWebhookUrl"
          class="shrink-0 px-2.5 py-1 rounded-md border border-jetblack/15 bg-white text-jetblack hover:bg-jetblack/5 text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
          title="Salin URL Webhook"
        >
          <Check v-if="copiedWebhook" class="w-3 h-3 text-forest stroke-[2.5]" />
          <Copy v-else class="w-3 h-3 text-jetblack/60" />
          <span>{{ copiedWebhook ? "Tersalin" : "Salin" }}</span>
        </button>
      </div>

      <!-- Demo Checkout Route Row -->
      <div
        class="px-3.5 sm:px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-[#8a6d1f] font-bold shrink-0">Demo Route:</span>
          <code class="font-mono font-bold text-jetblack text-[11px] truncate"
            >/demo/checkout/fastmail-ai?gateway=xendit</code
          >
        </div>
        <div class="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            @click="copyXenditDemoUrl"
            class="px-2.5 py-1 rounded-md border border-jetblack/15 bg-white text-jetblack hover:bg-jetblack/5 text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
            title="Salin URL Demo"
          >
            <Check v-if="copiedXenditDemo" class="w-3 h-3 text-forest stroke-[2.5]" />
            <Copy v-else class="w-3 h-3 text-jetblack/60" />
            <span>{{ copiedXenditDemo ? "Tersalin" : "Salin" }}</span>
          </button>
          <a
            :href="`${getAppOrigin()}/demo/checkout/fastmail-ai?gateway=xendit`"
            target="_blank"
            class="p-1.5 rounded-md border border-jetblack/15 bg-white text-jetblack hover:bg-jetblack/5 transition cursor-pointer"
            title="Buka Demo Checkout di Tab Baru"
          >
            <ExternalLink class="w-3.5 h-3.5 text-jetblack/70" />
          </a>
        </div>
      </div>

      <!-- Kredensial Server (.env) Status -->
      <div class="px-3.5 sm:px-4 md:px-6 py-4 space-y-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <ShieldCheck class="w-4 h-4 text-forest" />
            <span class="text-xs font-bold text-jetblack">Status Kredensial Server (.env)</span>
          </div>
          <span
            class="text-[10.5px] font-bold uppercase tracking-wider font-mono"
            :class="form.xendit_configured === 'true' ? 'text-forest' : 'text-[#8a6d1f]'"
          >
            {{
              form.xendit_configured === "true" ? "Terkonfigurasi di .env" : "Belum Lengkap di .env"
            }}
          </span>
        </div>

        <div class="divide-y divide-jetblack/10 font-mono text-[11px]">
          <div class="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span class="text-jetblack/55">XENDIT_SANDBOX_SECRET_KEY</span>
            <span
              class="inline-flex items-center gap-1"
              :class="
                form.xendit_secret_key ? 'text-forest font-semibold' : 'text-jetblack/40 italic'
              "
            >
              <Check v-if="form.xendit_secret_key" class="w-3 h-3 shrink-0" />
              {{ form.xendit_secret_key ? "Disetel (xnd_development_...)" : "Belum diisi di .env" }}
            </span>
          </div>
          <div class="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span class="text-jetblack/55">XENDIT_SANDBOX_WEBHOOK_VERIFICATION_TOKEN</span>
            <span
              class="inline-flex items-center gap-1"
              :class="
                form.xendit_webhook_token ? 'text-forest font-semibold' : 'text-jetblack/40 italic'
              "
            >
              <Check v-if="form.xendit_webhook_token" class="w-3 h-3 shrink-0" />
              {{ form.xendit_webhook_token ? "Disetel (Token Webhook)" : "Belum diisi di .env" }}
            </span>
          </div>
        </div>
      </div>

      <!-- UJI & SINKRONISASI CHANNEL PEMBAYARAN -->
      <div class="px-3.5 sm:px-4 md:px-6 py-4 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 class="text-xs font-bold text-jetblack flex items-center gap-1.5">
              <RefreshCw class="w-3.5 h-3.5 text-forest" />
              <span>Uji Koneksi &amp; Sinkronisasi Channel Pembayaran</span>
            </h3>
            <p class="text-[11px] text-jetblack/60 mt-0.5">
              Verifikasi channel aktif Xendit (QRIS Instan, Bank VA, Retail Gerai) dari engine
              runtime.
            </p>
          </div>
          <button
            type="button"
            @click="handleSyncChannels"
            :disabled="syncingChannels"
            class="px-3.5 h-8 rounded-lg bg-jetblack text-white hover:bg-jetblack/90 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto active:scale-95"
          >
            <RefreshCw class="w-3.5 h-3.5 text-gold" :class="{ 'animate-spin': syncingChannels }" />
            <span>{{ syncingChannels ? "Memverifikasi..." : "Uji Channel" }}</span>
          </button>
        </div>

        <!-- Channel Items with Hairline Dividers -->
        <div
          class="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-jetblack/10 border-t border-jetblack/10 pt-3"
        >
          <div class="py-2 sm:py-0 sm:pr-4 flex items-start gap-2">
            <QrCode class="w-4 h-4 text-forest shrink-0 mt-0.5" />
            <div class="text-[11px] leading-tight">
              <div class="font-bold text-jetblack">QRIS Realtime</div>
              <div class="text-jetblack/50 text-[10px] mt-0.5">GoPay, OVO, Dana, ShopeePay</div>
            </div>
          </div>
          <div class="py-2 sm:py-0 sm:px-4 flex items-start gap-2">
            <Landmark class="w-4 h-4 text-forest shrink-0 mt-0.5" />
            <div class="text-[11px] leading-tight">
              <div class="font-bold text-jetblack">Virtual Account (7 Bank)</div>
              <div class="text-jetblack/50 text-[10px] mt-0.5">
                BCA, Mandiri, BNI, BRI, Permata, BSI
              </div>
            </div>
          </div>
          <div class="py-2 sm:py-0 sm:pl-4 flex items-start gap-2">
            <Store class="w-4 h-4 text-forest shrink-0 mt-0.5" />
            <div class="text-[11px] leading-tight">
              <div class="font-bold text-jetblack">Gerai Retail Outlets</div>
              <div class="text-jetblack/50 text-[10px] mt-0.5">Indomaret &amp; Alfamart Group</div>
            </div>
          </div>
        </div>

        <!-- Live Probe Status Feedback Strip -->
        <div
          v-if="syncResult"
          class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-2.5 text-xs font-medium flex items-start gap-2 border-t transition mt-2"
          :class="
            syncResult.success
              ? 'bg-forest/10 border-forest/20 text-forest'
              : 'bg-crimson/10 border-crimson/20 text-crimson'
          "
        >
          <CheckCircle2 v-if="syncResult.success" class="w-4 h-4 text-forest shrink-0 mt-0.5" />
          <AlertCircle v-else class="w-4 h-4 text-crimson shrink-0 mt-0.5" />
          <div class="flex-1 leading-relaxed">
            <div class="flex items-center justify-between">
              <span class="font-bold">{{
                syncResult.success ? "Channel Siap:" : "Gagal Terhubung:"
              }}</span>
              <span class="text-[10px] font-mono opacity-70">{{ syncResult.timestamp }}</span>
            </div>
            <p class="mt-0.5">{{ syncResult.message || syncResult.error }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 2: MODE GATEWAY SANDBOX / PRODUCTION -->
    <section class="divide-y divide-jetblack/10">
      <div class="px-3.5 sm:px-4 md:px-6 py-4 flex items-center justify-between">
        <div>
          <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
            Mode Lingkungan (Sandbox vs Production)
          </h2>
          <p class="text-[11px] text-jetblack/60 mt-0.5">
            Tentukan apakah platform memproses transaksi simulasi sandbox atau pembayaran uang riil
            (Live).
          </p>
        </div>
        <span
          class="text-[11px] font-bold uppercase font-mono shrink-0"
          :class="form.sandbox_mode === 'true' ? 'text-[#8a6d1f]' : 'text-forest'"
        >
          {{ form.sandbox_mode === "true" ? "Sandbox" : "Production" }}
        </span>
      </div>

      <label
        class="px-3.5 sm:px-4 md:px-6 py-3.5 flex items-start gap-3 cursor-pointer select-none hover:bg-jetblack/[0.015] transition"
      >
        <input
          type="radio"
          name="sandbox_mode"
          value="true"
          v-model="form.sandbox_mode"
          class="text-amber-600 focus:ring-amber-500 w-4 h-4 mt-0.5"
        />
        <div>
          <span class="text-xs font-bold text-jetblack">Mode Sandbox (Pengujian)</span>
          <p class="text-[11px] text-jetblack/60 mt-0.5">
            Gunakan untuk pengujian checkout simulasi. Transaksi divalidasi dengan simulasi QRIS /
            VA tanpa memotong uang riil.
          </p>
        </div>
      </label>

      <label
        class="px-3.5 sm:px-4 md:px-6 py-3.5 flex items-start gap-3 cursor-pointer select-none hover:bg-jetblack/[0.015] transition"
      >
        <input
          type="radio"
          name="sandbox_mode"
          value="false"
          v-model="form.sandbox_mode"
          class="text-forest focus:ring-forest w-4 h-4 mt-0.5"
        />
        <div>
          <span class="text-xs font-bold text-jetblack">Mode Production (Live)</span>
          <p class="text-[11px] text-jetblack/60 mt-0.5">
            Gunakan kredensial produksi server. Seluruh pembayaran diproses langsung oleh perbankan
            dengan uang riil pembeli.
          </p>
        </div>
      </label>
    </section>

    <!-- SECTION 3: TAMPILAN HALAMAN CHECKOUT -->
    <section class="divide-y divide-jetblack/10">
      <div class="px-3.5 sm:px-4 md:px-6 py-4 flex items-center justify-between">
        <div>
          <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
            Tampilan Halaman Checkout (/pay/:slug)
          </h2>
          <p class="text-[11px] text-jetblack/60 mt-0.5">
            Pilih cara pembeli melihat formulir pembayaran saat membeli lisensi software builder.
          </p>
        </div>
        <span
          class="text-[11px] font-bold uppercase font-mono shrink-0"
          :class="form.checkout_mode === 'custom' ? 'text-forest' : 'text-jetblack'"
        >
          {{ form.checkout_mode === "custom" ? "Native Tertaut" : "Hosted Gateway" }}
        </span>
      </div>

      <label
        class="px-3.5 sm:px-4 md:px-6 py-3.5 flex items-start gap-3 cursor-pointer select-none hover:bg-jetblack/[0.015] transition"
      >
        <input
          type="radio"
          name="checkout_mode"
          value="custom"
          v-model="form.checkout_mode"
          class="text-forest focus:ring-forest w-4 h-4 mt-0.5"
        />
        <div>
          <span class="text-xs font-bold text-jetblack">Full Custom UI (Native Tertaut)</span>
          <p class="text-[11px] text-jetblack/60 mt-0.5">
            Pembeli tetap berada di domain tertaut.com/pay. Nomor VA, QRIS, petunjuk transfer, dan
            polling status instan ditampilkan langsung di halaman.
          </p>
        </div>
      </label>

      <label
        class="px-3.5 sm:px-4 md:px-6 py-3.5 flex items-start gap-3 cursor-pointer select-none hover:bg-jetblack/[0.015] transition"
      >
        <input
          type="radio"
          name="checkout_mode"
          value="hosted"
          v-model="form.checkout_mode"
          class="text-jetblack focus:ring-jetblack w-4 h-4 mt-0.5"
        />
        <div>
          <span class="text-xs font-bold text-jetblack">Hosted Checkout (Fallback Redirect)</span>
          <p class="text-[11px] text-jetblack/60 mt-0.5">
            Gunakan sebagai fallback bila terjadi kendala pada UI custom. Pembeli dialihkan langsung
            ke halaman checkout resmi gateway.
          </p>
        </div>
      </label>

      <div class="px-3.5 sm:px-4 md:px-6 py-2.5 text-[10.5px] text-jetblack/55 italic">
        * Pengaturan switch Full Custom UI vs Hosted Checkout berlaku universal untuk mode Sandbox
        maupun Production.
      </div>
    </section>

    <!-- SECTION 4: SAVE ACTION BOTTOM BAR -->
    <div
      class="px-3.5 sm:px-4 md:px-6 py-4 bg-jetblack/[0.015] flex items-center justify-between gap-4"
    >
      <div class="text-xs text-jetblack/60 hidden sm:block">
        Pastikan mode operasional (Sandbox/Live &amp; Tampilan Checkout) telah sesuai sebelum
        diterapkan ke checkout publik.
      </div>
      <button
        type="button"
        @click="emit('save')"
        :disabled="saving"
        class="h-9 px-5 rounded-lg btn-gold text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95 shrink-0 ml-auto sm:ml-0"
      >
        <span
          v-if="saving"
          class="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin"
        ></span>
        <Save v-else class="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Simpan</span>
      </button>
    </div>
  </div>
</template>
