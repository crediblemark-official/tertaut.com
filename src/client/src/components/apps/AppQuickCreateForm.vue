<script setup lang="ts">
import { ref } from "vue";
import type { AppItem, BillingPeriodType } from "../../types/app";
import type { AppCapabilityMode, PricingStrategy } from "../../lib/appCapability";
import AppPricingSection from "./AppPricingSection.vue";
import AppLivePreviewCard from "./AppLivePreviewCard.vue";
import {
  Check,
  CreditCard,
  KeyRound,
  Zap,
  ChevronDown,
  SlidersHorizontal,
  Pencil,
  Trash2,
  ArrowUpRight,
} from "lucide-vue-next";

defineProps<{
  hasPayment: boolean;
  hasLicense: boolean;
  isCreating: boolean;
  canSubmit: boolean;
  dashboardEnv: "sandbox" | "live";
  billingPeriodDisplay: string;
  isEditMode?: boolean;
  actionLabel?: string;
  initialApp?: AppItem | null;
}>();

const appName = defineModel<string>("appName", { required: true });
const appSlug = defineModel<string>("appSlug", { required: true });
const slugManuallyEdited = defineModel<boolean>("slugManuallyEdited", { required: true });
const capabilityMode = defineModel<AppCapabilityMode>("capabilityMode", { required: true });
const pricingStrategy = defineModel<PricingStrategy>("pricingStrategy", { required: true });
const pricingType = defineModel<"one_time" | "subscription" | "free">("pricingType", {
  required: true,
});
const price = defineModel<number>("price", { required: true });
const billingPeriod = defineModel<BillingPeriodType>("billingPeriod", { required: true });
const customBillingDays = defineModel<number>("customBillingDays", { required: true });
const hasTrialPeriod = defineModel<boolean>("hasTrialPeriod", { required: true });
const trialPeriodDays = defineModel<number>("trialPeriodDays", { required: true });
const returnUrl = defineModel<string>("returnUrl", { required: true });
const description = defineModel<string>("description", { required: true });

const emit = defineEmits<{
  cancel: [];
  submit: [];
  delete: [app: AppItem];
}>();

const showSlugInput = ref(false);
const showOptional = ref(false);

const capabilityModes = [
  {
    id: "payment_only" as const,
    label: "Pembayaran",
    desc: "QRIS, VA, E-Wallet & payout",
    icon: CreditCard,
    activeClass: "bg-emerald-50/60 text-emerald-950",
    iconClass: "text-emerald-700",
    checkClass: "text-emerald-700",
  },
  {
    id: "license_only" as const,
    label: "Lisensi",
    desc: "Serial key, seat & Ed25519",
    icon: KeyRound,
    activeClass: "bg-amber-50/70 text-amber-950",
    iconClass: "text-amber-700",
    checkClass: "text-amber-700",
  },
  {
    id: "both" as const,
    label: "Bayar + Lisensi",
    desc: "Terbit otomatis pasca bayar",
    icon: Zap,
    activeClass: "bg-gold/10 text-jetblack",
    iconClass: "text-[#8a6d1f]",
    checkClass: "text-[#8a6d1f]",
  },
];
</script>

<template>
  <form
    @submit.prevent="emit('submit')"
    class="-mx-3.5 sm:-mx-4 md:-mx-6 bg-white grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-jetblack/10 border-b border-jetblack/10"
  >
    <!-- Kolom Kiri: Form Utama (Hairline Stack) -->
    <div class="lg:col-span-8 divide-y divide-jetblack/10">
      <!-- 1. Nama & Slug -->
      <section class="px-3.5 sm:px-4 md:px-6 py-4 sm:py-5 space-y-2.5">
        <div>
          <label class="block text-xs font-bold text-jetblack mb-1.5">
            Nama Aplikasi <span class="text-rose-600">*</span>
          </label>
          <input
            v-model="appName"
            type="text"
            placeholder="Contoh: SuperPrompt Studio"
            class="w-full px-3.5 py-2.5 rounded-lg bg-white border border-jetblack/20 text-sm font-medium text-jetblack placeholder:text-jetblack/35 focus:outline-none focus:border-gold focus-visible:ring-2 focus-visible:ring-gold/20"
          />
        </div>

        <div class="flex items-center justify-between gap-2 text-[11px] text-jetblack/60">
          <span class="truncate font-mono tracking-wider">/{{ appSlug || "nama-aplikasi" }}</span>
          <button
            type="button"
            @click="showSlugInput = !showSlugInput"
            class="inline-flex items-center gap-1 text-forest font-semibold hover:underline cursor-pointer shrink-0"
          >
            <Pencil class="w-3 h-3" />
            <span>{{ showSlugInput ? "Tutup" : "Ubah" }}</span>
          </button>
        </div>

        <input
          v-if="showSlugInput"
          v-model="appSlug"
          @input="slugManuallyEdited = true"
          type="text"
          placeholder="superprompt-studio"
          class="w-full px-3 py-2 rounded-lg bg-jetblack/[0.02] border border-jetblack/15 text-xs font-mono tracking-wider text-jetblack focus:outline-none focus:border-gold"
        />
      </section>

      <!-- 2. Kebutuhan Utama -->
      <section class="px-3.5 sm:px-4 md:px-6 py-4 sm:py-5 space-y-2.5">
        <div class="text-xs font-bold text-jetblack">Kebutuhan Utama</div>

        <div
          class="-mx-3.5 sm:mx-0 grid grid-cols-1 sm:grid-cols-3 border-y sm:border border-jetblack/15 sm:rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-jetblack/10 overflow-hidden"
        >
          <button
            v-for="item in capabilityModes"
            :key="item.id"
            type="button"
            @click="capabilityMode = item.id"
            class="px-3.5 py-3 text-left transition-colors duration-150 cursor-pointer space-y-1 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold"
            :class="
              capabilityMode === item.id ? item.activeClass : 'bg-white hover:bg-jetblack/[0.02]'
            "
          >
            <div class="flex items-center justify-between gap-2">
              <span class="inline-flex items-center gap-1.5 text-xs font-bold text-jetblack">
                <component :is="item.icon" class="w-3.5 h-3.5 shrink-0" :class="item.iconClass" />
                {{ item.label }}
              </span>
              <Check
                v-if="capabilityMode === item.id"
                class="w-3.5 h-3.5 shrink-0"
                :class="item.checkClass"
              />
            </div>
            <div class="text-[11px] text-jetblack/60 leading-snug">{{ item.desc }}</div>
          </button>
        </div>
      </section>

      <!-- 3. Harga -->
      <section v-if="hasPayment" class="px-3.5 sm:px-4 md:px-6 py-4 sm:py-5 space-y-3.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs font-bold text-jetblack">Harga</div>
          <div
            class="inline-flex border border-jetblack/15 rounded-md divide-x divide-jetblack/10 overflow-hidden"
          >
            <button
              type="button"
              @click="pricingStrategy = 'fixed'"
              class="px-3 py-1 text-[11px] font-bold transition-colors cursor-pointer"
              :class="
                pricingStrategy === 'fixed'
                  ? 'bg-jetblack text-white'
                  : 'bg-white text-jetblack/65 hover:bg-jetblack/5'
              "
            >
              Tetap
            </button>
            <button
              type="button"
              @click="pricingStrategy = 'dynamic'"
              class="px-3 py-1 text-[11px] font-bold transition-colors cursor-pointer"
              :class="
                pricingStrategy === 'dynamic'
                  ? 'bg-jetblack text-white'
                  : 'bg-white text-jetblack/65 hover:bg-jetblack/5'
              "
            >
              Dinamis
            </button>
          </div>
        </div>

        <AppPricingSection
          v-if="pricingStrategy === 'fixed'"
          v-model:pricingType="pricingType"
          v-model:price="price"
          v-model:billingPeriod="billingPeriod"
          v-model:customBillingDays="customBillingDays"
          v-model:hasTrialPeriod="hasTrialPeriod"
          v-model:trialPeriodDays="trialPeriodDays"
        />

        <div v-else class="pt-2 border-t border-jetblack/10 text-[11px] text-jetblack/75">
          Nominal dikirim via <code class="font-mono font-bold text-forest">amount</code> pada
          <code class="font-mono font-bold text-forest">POST /api/v1/checkout/session</code>.
        </div>
      </section>

      <!-- 4. Opsional Accordion -->
      <section class="bg-jetblack/[0.015]">
        <button
          type="button"
          @click="showOptional = !showOptional"
          class="w-full px-3.5 sm:px-4 md:px-6 py-3.5 flex items-center justify-between text-xs font-semibold text-jetblack/75 hover:text-jetblack hover:bg-jetblack/[0.02] transition-colors cursor-pointer"
        >
          <span class="flex items-center gap-2">
            <SlidersHorizontal class="w-3.5 h-3.5 text-jetblack/50" />
            <span>{{
              hasPayment ? "Opsional (Return URL, Deskripsi)" : "Opsional (Deskripsi)"
            }}</span>
          </span>
          <ChevronDown
            class="w-4 h-4 text-jetblack/40 transition-transform duration-150"
            :class="{ 'rotate-180': showOptional }"
          />
        </button>

        <div
          v-if="showOptional"
          class="px-3.5 sm:px-4 md:px-6 py-4 border-t border-jetblack/10 space-y-3"
        >
          <div v-if="hasPayment">
            <label class="block text-[11px] font-bold text-jetblack/70 mb-1">Return URL</label>
            <input
              v-model="returnUrl"
              type="url"
              placeholder="https://aplikasianda.com/thanks"
              class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-jetblack/70 mb-1">Deskripsi</label>
            <textarea
              v-model="description"
              rows="2"
              placeholder="Ringkasan singkat aplikasi..."
              class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack resize-none focus:outline-none focus:border-gold"
            ></textarea>
          </div>
        </div>
      </section>

      <!-- 6. Danger Zone (Khusus Mode Edit) -->
      <section
        v-if="isEditMode && initialApp"
        class="px-3.5 sm:px-4 md:px-6 py-4 bg-rose-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <div class="text-xs font-bold text-rose-900 flex items-center gap-1.5">
            <Trash2 class="w-3.5 h-3.5 text-rose-600" />
            <span>Hapus Project</span>
          </div>
          <p class="text-[11px] text-rose-800/80 mt-0.5">
            Menghapus "{{ initialApp.name }}" bersifat permanen.
          </p>
        </div>
        <button
          type="button"
          @click="emit('delete', initialApp)"
          class="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-bold transition-all duration-150 inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Trash2 class="w-3.5 h-3.5" />
          <span>Hapus</span>
        </button>
      </section>
    </div>

    <!-- Kolom Kanan: Sidebar Live Preview Docked -->
    <aside class="lg:col-span-4 bg-jetblack/[0.015] p-3.5 sm:p-4 md:p-6">
      <div class="sticky top-6 space-y-4">
        <AppLivePreviewCard
          :appName="appName"
          :appSlug="appSlug"
          :appDesc="description"
          :pricingType="pricingType"
          :price="price"
          :billingPeriodDisplay="billingPeriodDisplay"
          :hasTrialPeriod="hasTrialPeriod"
          :trialPeriodDays="trialPeriodDays"
          :dashboardEnv="dashboardEnv"
          :isCreating="isCreating"
          :canPublish="canSubmit"
          :actionLabel="actionLabel || (isEditMode ? 'Simpan' : 'Buat')"
          :capabilityMode="capabilityMode"
          :pricingStrategy="pricingStrategy"
          :returnUrl="returnUrl"
          @publish="emit('submit')"
        />

        <!-- Info Manajemen Lisensi di Bawah Sidebar -->
        <div
          v-if="hasLicense"
          class="p-3.5 rounded-lg border border-amber-500/25 bg-amber-50/60 space-y-2.5"
        >
          <div class="flex items-start gap-2">
            <KeyRound class="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div class="text-[11px] leading-relaxed text-jetblack/75">
              <span class="font-bold text-jetblack">Lisensi diaktifkan.</span>
              Aturan kuota perangkat (seat), masa berlaku, dan kunci lisensi dikelola di menu
              <strong class="text-jetblack">Kelola Lisensi</strong>.
            </div>
          </div>
          <router-link
            v-if="isEditMode"
            :to="
              dashboardEnv === 'sandbox' ? '/dashboard/sandbox/licensing' : '/dashboard/licensing'
            "
            class="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-jetblack/15 bg-white text-[11px] font-bold text-jetblack hover:bg-jetblack/5 transition"
          >
            <span>Buka Kelola Lisensi</span>
            <ArrowUpRight class="w-3 h-3" />
          </router-link>
        </div>
      </div>
    </aside>
  </form>
</template>
