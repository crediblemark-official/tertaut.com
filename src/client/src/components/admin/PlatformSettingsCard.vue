<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "../../lib/api";
import {
  Sliders,
  Bell,
  Save,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  CreditCard,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-vue-next";

const emit = defineEmits<{
  (e: "alert", payload: { type: "success" | "error"; text: string }): void;
}>();

const loading = ref(false);
const saving = ref(false);
const showXenditKey = ref(false);
const showDanaSecret = ref(false);
const copiedWebhook = ref(false);
const copiedDanaWebhook = ref(false);

const form = ref({
  platform_fee_percent: "5",
  min_payout_threshold: "50000",
  announcement_banner: "",
  announcement_type: "info",
  active_payment_gateway: "dana",
  xendit_secret_key: "",
  xendit_webhook_token: "",
  dana_sandbox_client_id: "",
  dana_sandbox_client_secret: "",
  dana_sandbox_merchant_id: "",
  checkout_mode: "custom",
  sandbox_mode: "true",
});

function copyWebhookUrl() {
  const origin = window.location.origin.includes("localhost")
    ? "https://tertaut.com"
    : window.location.origin;
  const url = `${origin}/webhook/xendit`;
  navigator.clipboard.writeText(url);
  copiedWebhook.value = true;
  setTimeout(() => {
    copiedWebhook.value = false;
  }, 2000);
}

function copyDanaWebhookUrl() {
  const origin = window.location.origin.includes("localhost")
    ? "https://tertaut.com"
    : window.location.origin;
  const url = `${origin}/webhook/dana/notify`;
  navigator.clipboard.writeText(url);
  copiedDanaWebhook.value = true;
  setTimeout(() => {
    copiedDanaWebhook.value = false;
  }, 2000);
}

async function loadSettings() {
  loading.value = true;
  try {
    const res = await api.getPlatformSettings();
    if (res.success && res.settings) {
      form.value = {
        platform_fee_percent: res.settings.platform_fee_percent || "5",
        min_payout_threshold: res.settings.min_payout_threshold || "50000",
        announcement_banner: res.settings.announcement_banner || "",
        announcement_type: res.settings.announcement_type || "info",
        active_payment_gateway: res.settings.active_payment_gateway || "dana",
        xendit_secret_key: res.settings.xendit_secret_key || "",
        xendit_webhook_token: res.settings.xendit_webhook_token || "",
        dana_sandbox_client_id: res.settings.dana_sandbox_client_id || "",
        dana_sandbox_client_secret: res.settings.dana_sandbox_client_secret || "",
        dana_sandbox_merchant_id: res.settings.dana_sandbox_merchant_id || "",
        checkout_mode: res.settings.checkout_mode || "custom",
        sandbox_mode: res.settings.sandbox_mode !== "false" ? "true" : "false",
      };
    }
  } catch (err: any) {
    emit("alert", { type: "error", text: err.message || "Gagal memuat pengaturan platform." });
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  try {
    const res = await api.updatePlatformSettings(form.value);
    if (res.success) {
      emit("alert", { type: "success", text: "Pengaturan platform & gateway berhasil disimpan!" });
    } else {
      emit("alert", { type: "error", text: res.error || "Gagal menyimpan pengaturan." });
    }
  } catch (err: any) {
    emit("alert", {
      type: "error",
      text: err.message || "Terjadi kesalahan saat menyimpan pengaturan.",
    });
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadSettings();
});
</script>

<template>
  <div class="space-y-6 max-w-3xl divide-y divide-jetblack/10 pb-8">
    <!-- Section 1: Gateway Pembayaran -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">Gateway Pembayaran</h2>
        <span class="text-[11px] font-bold text-forest">
          Aktif: {{ form.active_payment_gateway.toUpperCase() }}
        </span>
      </div>

      <!-- 2-Option Radio Selection -->
      <div class="grid grid-cols-2 gap-3">
        <label
          class="flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition select-none"
          :class="
            form.active_payment_gateway === 'dana'
              ? 'border-forest bg-forest/5 text-jetblack font-bold'
              : 'border-jetblack/15 bg-white text-jetblack/70 hover:border-jetblack/30'
          "
        >
          <input
            type="radio"
            name="active_payment_gateway"
            value="dana"
            v-model="form.active_payment_gateway"
            class="text-forest focus:ring-forest"
          />
          <span class="text-xs">DANA Enterprise</span>
        </label>

        <label
          class="flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition select-none"
          :class="
            form.active_payment_gateway === 'xendit'
              ? 'border-blue-600 bg-blue-50/50 text-jetblack font-bold'
              : 'border-jetblack/15 bg-white text-jetblack/70 hover:border-jetblack/30'
          "
        >
          <input
            type="radio"
            name="active_payment_gateway"
            value="xendit"
            v-model="form.active_payment_gateway"
            class="text-blue-600 focus:ring-blue-500"
          />
          <span class="text-xs">Xendit</span>
        </label>
      </div>

      <!-- DANA Sandbox Config & Webhook (When DANA is selected) -->
      <div v-if="form.active_payment_gateway === 'dana'" class="space-y-3 pt-1">
        <!-- DANA Webhook URL Copy -->
        <div
          class="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-jetblack/5 border border-jetblack/10 text-xs"
        >
          <div class="font-mono text-jetblack/80 truncate">
            <span class="text-jetblack/40 select-none mr-1">Webhook DANA Notify:</span>
            <span>https://tertaut.com/webhook/dana/notify</span>
          </div>
          <button
            type="button"
            @click="copyDanaWebhookUrl"
            class="px-2.5 py-1 rounded bg-jetblack hover:bg-jetblack/80 text-white text-[11px] font-bold transition shrink-0 cursor-pointer"
          >
            {{ copiedDanaWebhook ? "Tersalin!" : "Salin" }}
          </button>
        </div>

        <div class="p-3.5 rounded-xl border border-forest/20 bg-forest/5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-jetblack flex items-center gap-1.5">
              <ShieldCheck class="w-3.5 h-3.5 text-forest" />
              <span>DANA Sandbox Credentials (Pengujian Panel)</span>
            </h3>
            <span class="text-[10px] text-forest font-bold uppercase tracking-wider">SANDBOX</span>
          </div>
          <p class="text-[11px] text-jetblack/70 leading-relaxed">
            Kredensial DANA Production tetap berada di
            <code class="font-mono bg-white px-1 py-0.5 rounded border border-jetblack/10"
              >.env.production</code
            >
            server. Gunakan form ini untuk konfigurasi akun DANA Sandbox saat mode sandbox aktif.
          </p>

          <div class="space-y-2 pt-1">
            <div class="space-y-1">
              <label class="text-xs text-jetblack/70 block"
                >DANA Sandbox Client ID / Partner ID</label
              >
              <input
                type="text"
                v-model="form.dana_sandbox_client_id"
                placeholder="202609..."
                class="w-full h-9 px-3 rounded-lg border border-jetblack/15 bg-white text-xs font-mono text-jetblack focus:border-gold"
              />
            </div>

            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-xs text-jetblack/70 block">DANA Sandbox Client Secret</label>
                <button
                  type="button"
                  @click="showDanaSecret = !showDanaSecret"
                  class="text-[11px] text-jetblack/50 hover:text-jetblack inline-flex items-center gap-1 cursor-pointer"
                >
                  <Eye v-if="!showDanaSecret" class="w-3 h-3" />
                  <EyeOff v-else class="w-3 h-3" />
                  <span>{{ showDanaSecret ? "Sembunyikan" : "Tampilkan" }}</span>
                </button>
              </div>
              <input
                :type="showDanaSecret ? 'text' : 'password'"
                v-model="form.dana_sandbox_client_secret"
                placeholder="Client secret DANA sandbox..."
                class="w-full h-9 px-3 rounded-lg border border-jetblack/15 bg-white text-xs font-mono text-jetblack focus:border-gold"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs text-jetblack/70 block">DANA Sandbox Merchant ID</label>
              <input
                type="text"
                v-model="form.dana_sandbox_merchant_id"
                placeholder="2166200..."
                class="w-full h-9 px-3 rounded-lg border border-jetblack/15 bg-white text-xs font-mono text-jetblack focus:border-gold"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Xendit Sandbox Config & Webhook (When Xendit is selected) -->
      <div v-if="form.active_payment_gateway === 'xendit'" class="space-y-3 pt-1">
        <!-- Xendit Webhook URL Copy -->
        <div
          class="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-jetblack/5 border border-jetblack/10 text-xs"
        >
          <div class="font-mono text-jetblack/80 truncate">
            <span class="text-jetblack/40 select-none mr-1">Webhook Xendit:</span>
            <span>https://tertaut.com/webhook/xendit</span>
          </div>
          <button
            type="button"
            @click="copyWebhookUrl"
            class="px-2.5 py-1 rounded bg-jetblack hover:bg-jetblack/80 text-white text-[11px] font-bold transition shrink-0 cursor-pointer"
          >
            {{ copiedWebhook ? "Tersalin!" : "Salin" }}
          </button>
        </div>

        <div class="p-3.5 rounded-xl border border-blue-600/20 bg-blue-50/50 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-jetblack flex items-center gap-1.5">
              <ShieldCheck class="w-3.5 h-3.5 text-blue-600" />
              <span>Xendit Sandbox Credentials (Pengujian Panel)</span>
            </h3>
            <span class="text-[10px] text-blue-600 font-bold uppercase tracking-wider"
              >SANDBOX</span
            >
          </div>
          <p class="text-[11px] text-jetblack/70 leading-relaxed">
            Kredensial Xendit Production tetap berada di
            <code class="font-mono bg-white px-1 py-0.5 rounded border border-jetblack/10"
              >.env.production</code
            >
            server. Gunakan form ini untuk konfigurasi akun Xendit Sandbox (<code class="font-mono"
              >xnd_development_...</code
            >).
          </p>

          <div class="space-y-2 pt-1">
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-xs text-jetblack/70 block"
                  >Xendit Secret API Key (Sandbox)</label
                >
                <button
                  type="button"
                  @click="showXenditKey = !showXenditKey"
                  class="text-[11px] text-jetblack/50 hover:text-jetblack inline-flex items-center gap-1 cursor-pointer"
                >
                  <Eye v-if="!showXenditKey" class="w-3 h-3" />
                  <EyeOff v-else class="w-3 h-3" />
                  <span>{{ showXenditKey ? "Sembunyikan" : "Tampilkan" }}</span>
                </button>
              </div>
              <input
                :type="showXenditKey ? 'text' : 'password'"
                v-model="form.xendit_secret_key"
                placeholder="xnd_development_..."
                class="w-full h-9 px-3 rounded-lg border border-jetblack/15 bg-white text-xs font-mono text-jetblack focus:border-gold"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs text-jetblack/70 block"
                >Xendit Webhook Verification Token</label
              >
              <input
                type="password"
                v-model="form.xendit_webhook_token"
                placeholder="Token verifikasi webhook dari dashboard Xendit"
                class="w-full h-9 px-3 rounded-lg border border-jetblack/15 bg-white text-xs font-mono text-jetblack focus:border-gold"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Section: Mode Gateway Sandbox / Production -->
    <div class="pt-6 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
          Mode Gateway Sandbox / Production
        </h2>
        <span
          class="text-[11px] font-bold"
          :class="form.sandbox_mode === 'true' ? 'text-amber-600' : 'text-emerald-700'"
        >
          {{ form.sandbox_mode === "true" ? "SANDBOX AKTIF" : "PRODUCTION (LIVE)" }}
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <!-- Sandbox Aktif -->
        <label
          class="flex flex-col gap-2 p-3.5 rounded-xl border cursor-pointer transition select-none"
          :class="
            form.sandbox_mode === 'true'
              ? 'border-amber-500 bg-amber-50/40 text-jetblack shadow-xs ring-1 ring-amber-500/20'
              : 'border-jetblack/15 bg-white text-jetblack/70 hover:border-jetblack/30'
          "
        >
          <div class="flex items-center gap-2.5">
            <input
              type="radio"
              name="sandbox_mode"
              value="true"
              v-model="form.sandbox_mode"
              class="text-amber-600 focus:ring-amber-500"
            />
            <span class="text-xs font-bold">Mode Sandbox (Pengujian)</span>
          </div>
          <p class="text-[11px] text-jetblack/70 leading-relaxed pl-6">
            Aktifkan sandbox untuk uji coba checkout. Gateway menggunakan form kredensial sandbox di
            atas tanpa memproses uang riil.
          </p>
        </label>

        <!-- Production Live -->
        <label
          class="flex flex-col gap-2 p-3.5 rounded-xl border cursor-pointer transition select-none"
          :class="
            form.sandbox_mode === 'false'
              ? 'border-emerald-600 bg-emerald-50/40 text-jetblack shadow-xs ring-1 ring-emerald-600/20'
              : 'border-jetblack/15 bg-white text-jetblack/70 hover:border-jetblack/30'
          "
        >
          <div class="flex items-center gap-2.5">
            <input
              type="radio"
              name="sandbox_mode"
              value="false"
              v-model="form.sandbox_mode"
              class="text-emerald-600 focus:ring-emerald-500"
            />
            <span class="text-xs font-bold">Mode Production (Live)</span>
          </div>
          <p class="text-[11px] text-jetblack/70 leading-relaxed pl-6">
            Gunakan kredensial produksi server dari file
            <code class="font-mono text-emerald-800 bg-emerald-100/70 px-1 py-0.5 rounded"
              >.env.production</code
            >. Transaksi memproses pembayaran asli.
          </p>
        </label>
      </div>
    </div>

    <!-- Section: Mode Tampilan Halaman Checkout -->
    <div class="pt-6 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
          Tampilan Halaman Checkout (/pay/:slug)
        </h2>
        <span
          class="text-[11px] font-bold"
          :class="form.checkout_mode === 'custom' ? 'text-forest' : 'text-blue-600'"
        >
          {{ form.checkout_mode === "custom" ? "FULL CUSTOM (NATIVE)" : "HOSTED GATEWAY" }}
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <!-- Option 1: Full Custom -->
        <label
          class="flex flex-col gap-2 p-3.5 rounded-xl border cursor-pointer transition select-none"
          :class="
            form.checkout_mode === 'custom'
              ? 'border-forest bg-forest/5 text-jetblack shadow-xs'
              : 'border-jetblack/15 bg-white text-jetblack/70 hover:border-jetblack/30'
          "
        >
          <div class="flex items-center gap-2.5">
            <input
              type="radio"
              name="checkout_mode"
              value="custom"
              v-model="form.checkout_mode"
              class="text-forest focus:ring-forest"
            />
            <span class="text-xs font-bold">Full Custom UI (Native Tertaut)</span>
          </div>
          <p class="text-[11px] text-jetblack/70 leading-relaxed pl-6">
            Pembeli tetap berada di domain tertaut.com/pay. Nomor VA, QRIS, petunjuk transfer, dan
            polling status instan ditampilkan langsung di halaman.
          </p>
        </label>

        <!-- Option 2: Hosted Gateway Redirect -->
        <label
          class="flex flex-col gap-2 p-3.5 rounded-xl border cursor-pointer transition select-none"
          :class="
            form.checkout_mode === 'hosted'
              ? 'border-blue-600 bg-blue-50/50 text-jetblack shadow-xs'
              : 'border-jetblack/15 bg-white text-jetblack/70 hover:border-jetblack/30'
          "
        >
          <div class="flex items-center gap-2.5">
            <input
              type="radio"
              name="checkout_mode"
              value="hosted"
              v-model="form.checkout_mode"
              class="text-blue-600 focus:ring-blue-500"
            />
            <span class="text-xs font-bold">Hosted Checkout (Fallback Redirect)</span>
          </div>
          <p class="text-[11px] text-jetblack/70 leading-relaxed pl-6">
            Gunakan sebagai fallback bila terjadi kendala pada UI custom. Pembeli dialihkan langsung
            ke halaman checkout resmi gateway.
          </p>
        </label>
      </div>
      <p class="text-[11px] text-slate-500 italic px-0.5">
        * Pengaturan switch Full Custom UI vs Hosted Checkout berlaku universal untuk mode Sandbox
        maupun Production.
      </p>
    </div>

    <!-- Section 2: Parameter Finansial -->
    <div class="pt-6 space-y-3">
      <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
        Komisi &amp; Pencairan
      </h2>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1">
          <label class="text-xs text-jetblack/70 block">Komisi Platform (%)</label>
          <input
            v-model="form.platform_fee_percent"
            type="number"
            min="0"
            max="50"
            step="0.5"
            class="w-full h-9 px-3 rounded-lg border border-jetblack/15 bg-white text-xs font-mono font-bold text-jetblack focus:border-gold"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs text-jetblack/70 block">Min. Pencairan (Rp)</label>
          <input
            v-model="form.min_payout_threshold"
            type="number"
            min="10000"
            step="5000"
            class="w-full h-9 px-3 rounded-lg border border-jetblack/15 bg-white text-xs font-mono font-bold text-jetblack focus:border-gold"
          />
        </div>
      </div>
    </div>

    <!-- Section 3: Pengumuman -->
    <div class="pt-6 space-y-3">
      <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">Pengumuman Broadcast</h2>

      <div class="space-y-2">
        <textarea
          v-model="form.announcement_banner"
          rows="2"
          placeholder="Tulis pengumuman untuk seluruh dashboard builder (kosongkan jika tidak ada)..."
          class="w-full p-2.5 rounded-lg border border-jetblack/15 bg-white text-xs text-jetblack focus:border-gold placeholder:text-jetblack/30"
        ></textarea>

        <div class="flex items-center gap-3">
          <label class="text-xs text-jetblack/70 shrink-0">Tipe Banner:</label>
          <select
            v-model="form.announcement_type"
            class="h-8 px-2.5 rounded-lg border border-jetblack/15 bg-white text-xs text-jetblack focus:border-gold"
          >
            <option value="info">Informasi (Biru)</option>
            <option value="warning">Peringatan (Kuning)</option>
            <option value="alert">Kritis (Merah)</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Save Button -->
    <div class="pt-6 flex justify-end">
      <button
        @click="handleSave"
        :disabled="saving"
        class="h-9 px-5 rounded-lg btn-gold text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
      >
        <span
          v-if="saving"
          class="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin"
        ></span>
        <Save v-else class="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Simpan Pengaturan</span>
      </button>
    </div>
  </div>
</template>
