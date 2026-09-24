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
const copiedWebhook = ref(false);

const form = ref({
  platform_fee_percent: "5",
  min_payout_threshold: "50000",
  announcement_banner: "",
  announcement_type: "info",
  active_payment_gateway: "dana",
  xendit_secret_key: "",
  xendit_webhook_token: "",
});

function copyWebhookUrl() {
  const url = `${window.location.origin}/api/v1/webhook/xendit`;
  navigator.clipboard.writeText(url);
  copiedWebhook.value = true;
  setTimeout(() => {
    copiedWebhook.value = false;
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
  <div class="space-y-6 max-w-4xl">
    <!-- Card 1: Multi Payment Gateway Configuration -->
    <div class="p-6 rounded-2xl bg-white border border-jetblack/10 shadow-xs space-y-5">
      <div class="flex items-center justify-between pb-3 border-b border-jetblack/10">
        <div class="flex items-center gap-2">
          <CreditCard class="w-4 h-4 text-emerald-600" />
          <h2 class="text-sm font-extrabold text-jetblack">
            Penyedia Gateway Pembayaran (Payment Gateway MoR)
          </h2>
        </div>
        <span
          class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
          :class="
            form.active_payment_gateway === 'xendit'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          "
        >
          <span
            class="w-1.5 h-1.5 rounded-full animate-pulse"
            :class="form.active_payment_gateway === 'xendit' ? 'bg-blue-600' : 'bg-emerald-600'"
          ></span>
          Gateway Aktif: {{ form.active_payment_gateway.toUpperCase() }}
        </span>
      </div>

      <!-- Gateway Selector Radios -->
      <div class="space-y-2">
        <label class="text-xs font-bold text-jetblack block">
          Pilih Gateway Pembayaran Utama yang Digunakan Platform
        </label>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <!-- DANA Card Option -->
          <label
            class="relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition select-none"
            :class="
              form.active_payment_gateway === 'dana'
                ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            "
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="active_payment_gateway"
                  value="dana"
                  v-model="form.active_payment_gateway"
                  class="text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span class="text-xs font-extrabold text-slate-900">DANA Enterprise</span>
              </div>
              <span
                class="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold"
              >
                SNAP BI Direct
              </span>
            </div>
            <p class="text-[11px] text-slate-500 mt-2 pl-6">
              Koneksi langsung QRIS Nasional, DANA Wallet, dan Virtual Account multi-bank berlisensi
              resmi MoR.
            </p>
          </label>

          <!-- Xendit Card Option -->
          <label
            class="relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition select-none"
            :class="
              form.active_payment_gateway === 'xendit'
                ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            "
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="active_payment_gateway"
                  value="xendit"
                  v-model="form.active_payment_gateway"
                  class="text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span class="text-xs font-extrabold text-slate-900">Xendit Payment Gateway</span>
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold">
                Invoice & Multi-Bank
              </span>
            </div>
            <p class="text-[11px] text-slate-500 mt-2 pl-6">
              Mendukung Xendit Hosted Invoice, QRIS Nasional, Virtual Account (BCA, Mandiri, BNI,
              BRI, Permata, CIMB), E-Wallet, dan Kartu Kredit.
            </p>
          </label>
        </div>
      </div>

      <!-- Xendit Credentials Panel -->
      <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 pt-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-xs font-extrabold text-slate-900">
            <Key class="w-3.5 h-3.5 text-blue-600" />
            <span>Kredensial & Webhook Xendit</span>
          </div>
          <span class="text-[11px] text-slate-500">
            Dapat juga disetel via Dokploy Env:
            <code class="font-mono text-[10px] bg-slate-200 px-1 py-0.5 rounded"
              >XENDIT_SECRET_KEY</code
            >
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Xendit Secret Key -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-800 block">
              Xendit Secret API Key (<code class="font-mono text-[10px]"
                >xnd_production_... / xnd_development_...</code
              >)
            </label>
            <div class="relative">
              <input
                :type="showXenditKey ? 'text' : 'password'"
                v-model="form.xendit_secret_key"
                placeholder="xnd_development_..."
                class="w-full h-10 px-3 pr-10 rounded-lg border border-slate-300 bg-white text-xs font-mono font-medium text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
              <button
                type="button"
                @click="showXenditKey = !showXenditKey"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <EyeOff v-if="showXenditKey" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Xendit Webhook Verification Token -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-800 block">
              Xendit Webhook Verification Token
            </label>
            <input
              type="text"
              v-model="form.xendit_webhook_token"
              placeholder="Masukkan callback token dari dashboard Xendit..."
              class="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-mono font-medium text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        </div>

        <!-- Webhook URL Callback Copy Box -->
        <div
          class="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-slate-200"
        >
          <div class="text-[11px] text-slate-600">
            <span class="font-bold text-slate-900">URL Webhook Xendit Platform:</span>
            <span class="font-mono text-blue-700 ml-1.5 break-all"
              >https://tertaut.com/api/v1/webhook/xendit</span
            >
          </div>
          <button
            type="button"
            @click="copyWebhookUrl"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition shrink-0 cursor-pointer"
          >
            <Check v-if="copiedWebhook" class="w-3.5 h-3.5 text-emerald-400" />
            <Copy v-else class="w-3.5 h-3.5" />
            <span>{{ copiedWebhook ? "Tersalin!" : "Salin URL Webhook" }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Card 2: MoR Financial Parameters -->
    <div class="p-6 rounded-2xl bg-white border border-jetblack/10 shadow-xs space-y-4">
      <div class="flex items-center gap-2 pb-3 border-b border-jetblack/10">
        <Sliders class="w-4 h-4 text-gold" />
        <h2 class="text-sm font-extrabold text-jetblack">Parameter Merchant of Record (MoR)</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <!-- Platform Fee % -->
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-jetblack block"> Komisi Platform MoR (%) </label>
          <div class="relative">
            <input
              v-model="form.platform_fee_percent"
              type="number"
              min="0"
              max="50"
              step="0.5"
              class="w-full h-10 px-3 pr-8 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-jetblack focus:ring-2 focus:ring-gold/20 focus:border-gold transition"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400"
              >%</span
            >
          </div>
          <p class="text-[11px] text-slate-500">
            Persentase resmi yang dipotong otomatis saat transaksi berhasil. Default 5%.
          </p>
        </div>

        <!-- Min Payout Threshold -->
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-jetblack block">
            Batas Minimum Pencairan (IDR)
          </label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400"
              >Rp</span
            >
            <input
              v-model="form.min_payout_threshold"
              type="number"
              min="10000"
              step="5000"
              class="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-jetblack focus:ring-2 focus:ring-gold/20 focus:border-gold transition"
            />
          </div>
          <p class="text-[11px] text-slate-500">
            Saldo bersih minimal agar builder dapat mencairkan dana. Default Rp 50.000.
          </p>
        </div>
      </div>
    </div>

    <!-- Card 3: Broadcast Announcement Banner -->
    <div class="p-6 rounded-2xl bg-white border border-jetblack/10 shadow-xs space-y-4">
      <div class="flex items-center gap-2 pb-3 border-b border-jetblack/10">
        <Bell class="w-4 h-4 text-emerald-600" />
        <h2 class="text-sm font-extrabold text-jetblack">Pengumuman Broadcast Platform</h2>
      </div>

      <div class="space-y-4 pt-2">
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-jetblack block">
            Teks Pengumuman (Tampil di Seluruh Dashboard Builder)
          </label>
          <textarea
            v-model="form.announcement_banner"
            rows="3"
            placeholder="Kosongkan jika tidak ada pengumuman aktif. Contoh: Pemeliharaan gateway terjadwal hari Minggu pukul 02:00 WIB."
            class="w-full p-3 rounded-lg border border-slate-300 bg-white text-xs text-jetblack focus:ring-2 focus:ring-gold/20 focus:border-gold transition"
          ></textarea>
        </div>

        <div class="space-y-1.5 max-w-xs">
          <label class="text-xs font-bold text-jetblack block">Tipe Banner</label>
          <select
            v-model="form.announcement_type"
            class="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-medium text-jetblack"
          >
            <option value="info">Informasi (Biru / Netral)</option>
            <option value="warning">Peringatan (Kuning / Amber)</option>
            <option value="alert">Penting / Kritis (Merah)</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Save Button -->
    <div class="flex justify-end">
      <button
        @click="handleSave"
        :disabled="saving"
        class="h-10 px-6 rounded-xl btn-gold text-xs font-bold transition inline-flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
      >
        <span
          v-if="saving"
          class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"
        ></span>
        <Save v-else class="w-4 h-4 stroke-[2.5]" />
        <span>Simpan Pengaturan</span>
      </button>
    </div>
  </div>
</template>
