<script setup lang="ts">
import { computed } from "vue";
import type { AppItem } from "../../types/app";
import { inferAppCapability } from "../../lib/appCapability";
import { useClipboard } from "../../composables/useClipboard";
import BaseModal from "../common/BaseModal.vue";
import {
  Copy,
  Check,
  ExternalLink,
  KeyRound,
  CreditCard,
  Zap,
  SlidersHorizontal,
} from "lucide-vue-next";

const props = defineProps<{
  show: boolean;
  app: AppItem | null;
}>();

const emit = defineEmits<{
  close: [];
  configure: [app: AppItem];
}>();

const { copy: copyAppId, copied: copiedAppId } = useClipboard();
const { copy: copyApiKey, copied: copiedApiKey } = useClipboard();
const { copy: copyPayUrl, copied: copiedPayUrl } = useClipboard();
const { copy: copySnippet, copied: copiedSnippet } = useClipboard();

const capability = computed(() => (props.app ? inferAppCapability(props.app) : null));
const hasLicense = computed(() => Boolean(capability.value?.hasLicense));
const isDynamicPrice = computed(() => capability.value?.pricingStrategy === "dynamic");
const isLicenseOnly = computed(() => capability.value?.mode === "license_only");
const hasPayment = computed(() => Boolean(capability.value?.hasPayment));

const capabilityLabel = computed(() => {
  if (!capability.value) return "";
  if (capability.value.mode === "license_only") return "Lisensi Saja";
  if (capability.value.mode === "both") return "Pembayaran + Lisensi";
  return "Pembayaran Saja";
});

const hostedCheckoutUrl = computed(() => {
  if (!props.app) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://tertaut.com";
  return `${origin}/pay/${props.app.slug}`;
});

const quickSnippet = computed(() => {
  if (!props.app) return "";
  const appId = props.app.id;
  const apiKey = props.app.apiKey || "tt_live_xxxx";

  if (isLicenseOnly.value) {
    return `import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({
  apiKey: "${apiKey}",
  appId: "${appId}",
});

// 1. Aktivasi lisensi di perangkat user
const { data } = await tertaut.licensing.activate({
  licenseKey: "TT-XXXX-XXXX-XXXX",
  hwid: deviceId,
});

// 2. Verifikasi berkala (online + fallback offline Ed25519)
const check = await tertaut.licensing.check({
  licenseKey: "TT-XXXX-XXXX-XXXX",
  hwid: deviceId,
  offlineToken: data.licenseToken,
});`;
  }

  if (isDynamicPrice.value) {
    return `import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({
  apiKey: process.env.TERTAUT_SECRET_KEY!, // tt_secret_...
});

const { checkoutUrl } = await tertaut.checkout({
  appId: "${appId}",
  amount: 99000,
  customerEmail: "user@example.com",
  metadata: { userId: "usr_123" },
});`;
  }

  if (hasLicense.value) {
    return `// Checkout: ${hostedCheckoutUrl.value}

import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({
  apiKey: "${apiKey}",
  appId: "${appId}",
});

const res = await tertaut.licensing.check({
  licenseKey: "TT-XXXX-XXXX-XXXX",
  hwid: deviceId,
});`;
  }

  return `// Checkout: ${hostedCheckoutUrl.value}

import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({
  apiKey: "${apiKey}",
  appId: "${appId}",
});

await tertaut.checkout({
  customerEmail: "pembeli@example.com",
  autoRedirect: true,
});`;
});
</script>

<template>
  <BaseModal
    :show="show && Boolean(app)"
    title="Aplikasi Siap Digunakan"
    max-width="max-w-lg"
    @close="emit('close')"
  >
    <template #title-icon>
      <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
    </template>

    <div v-if="app" class="text-xs divide-y divide-jetblack/10">
      <!-- Top Status Summary Strip -->
      <div class="px-5 py-3.5 bg-jetblack/[0.02] flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-bold text-jetblack truncate">{{ app.name }}</span>
            <span
              class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border"
              :class="
                app.mode === 'live'
                  ? 'bg-emerald-500/10 text-forest border-emerald-500/20'
                  : 'bg-amber-500/10 text-[#8a6d1f] border-amber-500/25'
              "
            >
              {{ app.mode }}
            </span>
          </div>
          <p class="text-[11px] text-jetblack/60 mt-0.5">
            Project aktif dan siap menerima integrasi SDK maupun tautan checkout.
          </p>
        </div>

        <span
          class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-gold/15 text-[#8a6d1f] border border-gold/25 shrink-0"
        >
          <Zap v-if="hasPayment && hasLicense" class="w-3 h-3" />
          <KeyRound v-else-if="hasLicense" class="w-3 h-3" />
          <CreditCard v-else class="w-3 h-3" />
          <span>{{ capabilityLabel }}</span>
        </span>
      </div>

      <!-- Credentials Hairline Rows -->
      <div class="px-5 divide-y divide-jetblack/10">
        <div class="flex items-center justify-between gap-3 py-2.5">
          <span class="text-[11px] font-semibold text-jetblack/60 shrink-0">App ID</span>
          <div class="flex items-center gap-1.5 min-w-0">
            <code class="font-mono tracking-wide text-[11px] font-bold text-jetblack truncate">
              {{ app.id }}
            </code>
            <button
              type="button"
              @click="copyAppId(app.id)"
              class="p-1 rounded hover:bg-jetblack/10 active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 text-jetblack/60 hover:text-jetblack transition cursor-pointer shrink-0"
              title="Salin App ID"
              aria-label="Salin App ID"
            >
              <Check v-if="copiedAppId" class="w-3.5 h-3.5 text-emerald-600" />
              <Copy v-else class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div v-if="app.apiKey" class="flex items-center justify-between gap-3 py-2.5">
          <span class="text-[11px] font-semibold text-jetblack/60 shrink-0">Publishable Key</span>
          <div class="flex items-center gap-1.5 min-w-0">
            <code class="font-mono tracking-wide text-[11px] font-bold text-jetblack truncate">
              {{ app.apiKey }}
            </code>
            <button
              type="button"
              @click="copyApiKey(app.apiKey)"
              class="p-1 rounded hover:bg-jetblack/10 active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 text-jetblack/60 hover:text-jetblack transition cursor-pointer shrink-0"
              title="Salin API Key"
              aria-label="Salin API Key"
            >
              <Check v-if="copiedApiKey" class="w-3.5 h-3.5 text-emerald-600" />
              <Copy v-else class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          v-if="hasPayment && !isDynamicPrice"
          class="flex items-center justify-between gap-3 py-2.5"
        >
          <span class="text-[11px] font-semibold text-jetblack/60 shrink-0">Link Checkout</span>
          <div class="flex items-center gap-1.5 min-w-0">
            <a
              :href="hostedCheckoutUrl"
              target="_blank"
              class="font-mono text-[11px] font-semibold text-forest hover:underline truncate flex items-center gap-1"
            >
              <span class="truncate">/pay/{{ app.slug }}</span>
              <ExternalLink class="w-3 h-3 shrink-0" />
            </a>
            <button
              type="button"
              @click="copyPayUrl(hostedCheckoutUrl)"
              class="p-1 rounded hover:bg-jetblack/10 active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 text-jetblack/60 hover:text-jetblack transition cursor-pointer shrink-0"
              title="Salin URL Checkout"
              aria-label="Salin URL Checkout"
            >
              <Check v-if="copiedPayUrl" class="w-3.5 h-3.5 text-emerald-600" />
              <Copy v-else class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Contextual Quick Snippet -->
      <div class="px-5 py-3.5 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold uppercase tracking-wider text-jetblack/60">
            Snippet Integrasi (@tertaut/sdk)
          </span>
          <button
            type="button"
            @click="copySnippet(quickSnippet)"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-jetblack/15 bg-white text-[11px] font-semibold text-jetblack/80 hover:text-jetblack hover:bg-jetblack/5 active:scale-[0.97] transition cursor-pointer"
          >
            <Check v-if="copiedSnippet" class="w-3 h-3 text-emerald-600" />
            <Copy v-else class="w-3 h-3" />
            <span>{{ copiedSnippet ? "Tersalin" : "Salin" }}</span>
          </button>
        </div>
        <pre
          class="rounded-lg bg-jetblack text-white/90 px-3.5 py-3 text-[11px] font-mono overflow-x-auto leading-relaxed border border-jetblack"
        ><code>{{ quickSnippet }}</code></pre>
      </div>
    </div>

    <template v-if="app" #footer>
      <div class="flex items-center justify-between gap-2">
        <button
          type="button"
          @click="emit('configure', app)"
          title="Atur Tampilan & Webhook"
          aria-label="Atur Tampilan & Webhook"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-jetblack/15 bg-white text-xs font-semibold text-jetblack/80 hover:text-jetblack hover:bg-jetblack/5 active:scale-[0.98] transition cursor-pointer"
        >
          <SlidersHorizontal class="w-3.5 h-3.5" />
          <span>Atur Konfigurasi</span>
        </button>

        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-1.5 rounded-lg btn-gold text-xs font-bold shadow-xs active:scale-[0.98] transition cursor-pointer"
        >
          Selesai
        </button>
      </div>
    </template>
  </BaseModal>
</template>
