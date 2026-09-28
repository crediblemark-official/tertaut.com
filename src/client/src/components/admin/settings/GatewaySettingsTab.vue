<script setup lang="ts">
import { ref } from "vue";
import type { PlatformSettingsFormData } from "../../../types/panel";
import { Save, CreditCard, Key, Eye, EyeOff, Copy, Check, ExternalLink } from "lucide-vue-next";

const props = defineProps<{
  form: PlatformSettingsFormData;
  saving: boolean;
}>();

const emit = defineEmits<{
  (e: "save"): void;
}>();

const showXenditKey = ref(false);
const showXenithSecret = ref(false);
const showDanaSecret = ref(false);
const copiedWebhook = ref(false);
const copiedDanaWebhook = ref(false);
const copiedXenithWebhook = ref(false);
const copiedXenithDemo = ref(false);
const copiedDanaDemo = ref(false);
const copiedXenditDemo = ref(false);

function getAppOrigin() {
  return window.location.origin.includes("localhost")
    ? window.location.origin
    : "https://tertaut.com";
}

function copyDanaDemoUrl() {
  const url = `${getAppOrigin()}/demo/checkout/fastmail-ai?gateway=dana`;
  navigator.clipboard.writeText(url);
  copiedDanaDemo.value = true;
  setTimeout(() => (copiedDanaDemo.value = false), 2000);
}

function copyXenditDemoUrl() {
  const url = `${getAppOrigin()}/demo/checkout/fastmail-ai?gateway=xendit`;
  navigator.clipboard.writeText(url);
  copiedXenditDemo.value = true;
  setTimeout(() => (copiedXenditDemo.value = false), 2000);
}

function copyXenithDemoUrl() {
  const url = `${getAppOrigin()}/demo/checkout/fastmail-ai?gateway=xenith`;
  navigator.clipboard.writeText(url);
  copiedXenithDemo.value = true;
  setTimeout(() => (copiedXenithDemo.value = false), 2000);
}

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

function copyXenithWebhookUrl() {
  const origin = window.location.origin.includes("localhost")
    ? "https://tertaut.com"
    : window.location.origin;
  navigator.clipboard.writeText(`${origin}/api/v1/webhook/xenithpay`);
  copiedXenithWebhook.value = true;
  setTimeout(() => {
    copiedXenithWebhook.value = false;
  }, 2000);
}
</script>

<template>
  <div class="space-y-6 divide-y divide-jetblack/10 animate-fadeIn">
    <!-- Section 1: Gateway Pembayaran -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">Gateway Pembayaran</h2>
        <span class="text-[11px] font-bold text-forest">
          Aktif: {{ form.active_payment_gateway.toUpperCase() }}
        </span>
      </div>

      <!-- 3-Option Radio Selection -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

        <label
          class="flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition select-none"
          :class="
            form.active_payment_gateway === 'xenithpay'
              ? 'border-emerald-600 bg-emerald-50/50 text-jetblack font-bold'
              : 'border-jetblack/15 bg-white text-jetblack/70 hover:border-jetblack/30'
          "
        >
          <input
            type="radio"
            name="active_payment_gateway"
            value="xenithpay"
            v-model="form.active_payment_gateway"
            class="text-emerald-600 focus:ring-emerald-500"
          />
          <span class="text-xs">XenithPay</span>
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
            class="shrink-0 text-jetblack/60 hover:text-jetblack p-1 transition cursor-pointer"
            title="Salin URL Webhook"
          >
            <Check v-if="copiedDanaWebhook" class="w-3.5 h-3.5 text-forest" />
            <Copy v-else class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- DANA Demo Checkout Route Path Display -->
        <div
          class="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs"
        >
          <div class="font-mono text-jetblack/80 truncate">
            <span class="text-amber-800/60 font-sans font-semibold select-none mr-1.5"
              >Demo Route Path:</span
            >
            <span class="text-amber-900 font-bold">/demo/checkout/fastmail-ai?gateway=dana</span>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              @click="copyDanaDemoUrl"
              class="text-amber-800 hover:text-amber-950 p-1 transition cursor-pointer"
              title="Salin Demo URL Lengkap"
            >
              <Check v-if="copiedDanaDemo" class="w-3.5 h-3.5 text-forest" />
              <Copy v-else class="w-3.5 h-3.5" />
            </button>
            <a
              :href="`${getAppOrigin()}/demo/checkout/fastmail-ai?gateway=dana`"
              target="_blank"
              class="text-amber-800 hover:text-amber-950 p-1 transition cursor-pointer"
              title="Buka Demo Checkout di Tab Baru"
            >
              <ExternalLink class="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <!-- Sandbox Credentials Form -->
        <div class="p-3.5 rounded-lg border border-jetblack/10 bg-jetblack/[0.02] space-y-3">
          <div class="flex items-center gap-2">
            <Key class="w-3.5 h-3.5 text-jetblack/60" />
            <span class="text-xs font-bold text-jetblack">Kredensial DANA Enterprise Sandbox</span>
          </div>

          <div class="space-y-2.5">
            <div class="space-y-1">
              <label class="text-xs text-jetblack/70 block">Sandbox Client ID</label>
              <input
                v-model="form.dana_sandbox_client_id"
                type="text"
                placeholder="Client ID dari DANA Developer Portal Sandbox"
                class="w-full h-9 px-3 rounded-lg border border-jetblack/15 bg-white text-xs font-mono text-jetblack focus:border-gold"
              />
            </div>
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-xs text-jetblack/70 block">Sandbox Client Secret</label>
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
                v-model="form.dana_sandbox_client_secret"
                :type="showDanaSecret ? 'text' : 'password'"
                placeholder="Client Secret dari DANA Sandbox"
                class="w-full h-9 px-3 rounded-lg border border-jetblack/15 bg-white text-xs font-mono text-jetblack focus:border-gold"
              />
            </div>
            <div class="space-y-1">
              <label class="text-xs text-jetblack/70 block">Sandbox Merchant ID</label>
              <input
                v-model="form.dana_sandbox_merchant_id"
                type="text"
                placeholder="Merchant ID (X-Partner-ID) dari DANA Sandbox"
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
            <span class="text-jetblack/40 select-none mr-1">Webhook URL:</span>
            <span>https://tertaut.com/webhook/xendit</span>
          </div>
          <button
            type="button"
            @click="copyWebhookUrl"
            class="shrink-0 text-jetblack/60 hover:text-jetblack p-1 transition cursor-pointer"
            title="Salin URL Webhook"
          >
            <Check v-if="copiedWebhook" class="w-3.5 h-3.5 text-forest" />
            <Copy v-else class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Xendit Demo Checkout Route Path Display -->
        <div
          class="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs"
        >
          <div class="font-mono text-jetblack/80 truncate">
            <span class="text-blue-800/60 font-sans font-semibold select-none mr-1.5"
              >Demo Route Path:</span
            >
            <span class="text-blue-900 font-bold">/demo/checkout/fastmail-ai?gateway=xendit</span>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              @click="copyXenditDemoUrl"
              class="text-blue-800 hover:text-blue-950 p-1 transition cursor-pointer"
              title="Salin Demo URL Lengkap"
            >
              <Check v-if="copiedXenditDemo" class="w-3.5 h-3.5 text-forest" />
              <Copy v-else class="w-3.5 h-3.5" />
            </button>
            <a
              :href="`${getAppOrigin()}/demo/checkout/fastmail-ai?gateway=xendit`"
              target="_blank"
              class="text-blue-800 hover:text-blue-950 p-1 transition cursor-pointer"
              title="Buka Demo Checkout di Tab Baru"
            >
              <ExternalLink class="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <!-- Sandbox Credentials Form -->
        <div class="p-3.5 rounded-lg border border-jetblack/10 bg-jetblack/[0.02] space-y-3">
          <div class="flex items-center gap-2">
            <Key class="w-3.5 h-3.5 text-jetblack/60" />
            <span class="text-xs font-bold text-jetblack">Kredensial Xendit Sandbox</span>
          </div>

          <div class="space-y-2.5">
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-xs text-jetblack/70 block">Secret Key (Sandbox)</label>
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
                v-model="form.xendit_secret_key"
                :type="showXenditKey ? 'text' : 'password'"
                placeholder="xnd_development_..."
                class="w-full h-9 px-3 rounded-lg border border-jetblack/15 bg-white text-xs font-mono text-jetblack focus:border-gold"
              />
            </div>
            <div class="space-y-1">
              <label class="text-xs text-jetblack/70 block"
                >Webhook Verification Token (Sandbox)</label
              >
              <input
                v-model="form.xendit_webhook_token"
                type="password"
                placeholder="Token verifikasi webhook dari Xendit Dashboard"
                class="w-full h-9 px-3 rounded-lg border border-jetblack/15 bg-white text-xs font-mono text-jetblack focus:border-gold"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- XenithPay Sandbox Config & Webhook (When XenithPay is selected) -->
      <div v-if="form.active_payment_gateway === 'xenithpay'" class="space-y-3 pt-1">
        <!-- XenithPay Webhook URL Copy -->
        <div
          class="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-jetblack/5 border border-jetblack/10 text-xs"
        >
          <div class="font-mono text-jetblack/80 truncate">
            <span class="text-jetblack/40 select-none mr-1">Webhook URL:</span>
            <span>https://tertaut.com/api/v1/webhook/xenithpay</span>
          </div>
          <button
            type="button"
            @click="copyXenithWebhookUrl"
            class="shrink-0 text-jetblack/60 hover:text-jetblack p-1 transition cursor-pointer"
            title="Salin URL Webhook"
          >
            <Check v-if="copiedXenithWebhook" class="w-3.5 h-3.5 text-forest" />
            <Copy v-else class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- XenithPay Demo Checkout Route Path Display -->
        <div
          class="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs"
        >
          <div class="font-mono text-jetblack/80 truncate">
            <span class="text-emerald-800/60 font-sans font-semibold select-none mr-1.5"
              >Demo Route Path:</span
            >
            <span class="text-emerald-900 font-bold"
              >/demo/checkout/fastmail-ai?gateway=xenith</span
            >
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              @click="copyXenithDemoUrl"
              class="text-emerald-800 hover:text-emerald-950 p-1 transition cursor-pointer"
              title="Salin Demo URL Lengkap"
            >
              <Check v-if="copiedXenithDemo" class="w-3.5 h-3.5 text-forest" />
              <Copy v-else class="w-3.5 h-3.5" />
            </button>
            <a
              :href="`${getAppOrigin()}/demo/checkout/fastmail-ai?gateway=xenith`"
              target="_blank"
              class="text-emerald-800 hover:text-emerald-950 p-1 transition cursor-pointer"
              title="Buka Demo Checkout di Tab Baru"
            >
              <ExternalLink class="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <!-- Sandbox Credentials Form -->
        <div class="p-3.5 rounded-lg border border-jetblack/10 bg-jetblack/[0.02] space-y-3">
          <div class="flex items-center gap-2">
            <Key class="w-3.5 h-3.5 text-jetblack/60" />
            <span class="text-xs font-bold text-jetblack">Kredensial XenithPay Sandbox</span>
          </div>

          <div class="space-y-2.5">
            <div class="space-y-1">
              <label class="text-xs text-jetblack/70 block">Sandbox Access Key (Client ID)</label>
              <input
                v-model="form.xenithpay_sandbox_access_key"
                type="text"
                placeholder="Access key dari XenithPay Sandbox"
                class="w-full h-9 px-3 rounded-lg border border-jetblack/15 bg-white text-xs font-mono text-jetblack focus:border-gold"
              />
            </div>
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-xs text-jetblack/70 block">Sandbox Secret Key</label>
                <button
                  type="button"
                  @click="showXenithSecret = !showXenithSecret"
                  class="text-[11px] text-jetblack/50 hover:text-jetblack inline-flex items-center gap-1 cursor-pointer"
                >
                  <Eye v-if="!showXenithSecret" class="w-3 h-3" />
                  <EyeOff v-else class="w-3 h-3" />
                  <span>{{ showXenithSecret ? "Sembunyikan" : "Tampilkan" }}</span>
                </button>
              </div>
              <input
                v-model="form.xenithpay_sandbox_secret_key"
                :type="showXenithSecret ? 'text' : 'password'"
                placeholder="Secret key dari XenithPay Sandbox"
                class="w-full h-9 px-3 rounded-lg border border-jetblack/15 bg-white text-xs font-mono text-jetblack focus:border-gold"
              />
            </div>
            <div class="space-y-1">
              <label class="text-xs text-jetblack/70 block">Sandbox Webhook Signature Secret</label>
              <input
                v-model="form.xenithpay_sandbox_webhook_secret"
                type="password"
                placeholder="Webhook signature secret dari XenithPay Sandbox"
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

    <!-- Save Button for Gateway Tab -->
    <div class="pt-6 flex justify-end">
      <button
        @click="emit('save')"
        :disabled="saving"
        class="h-9 px-5 rounded-lg btn-gold text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
      >
        <span
          v-if="saving"
          class="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin"
        ></span>
        <Save v-else class="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Simpan Pengaturan Gateway</span>
      </button>
    </div>
  </div>
</template>
