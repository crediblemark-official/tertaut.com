<script setup lang="ts">
import { ref, computed } from "vue";
import type { BillingPeriodType } from "../../types/app";
import { Sparkles, ChevronDown, Check } from "lucide-vue-next";

const props = defineProps<{
  pricingType: "one_time" | "subscription" | "free";
  price: number;
  billingPeriod: BillingPeriodType;
  customBillingDays: number;
  hasTrialPeriod: boolean;
  trialPeriodDays: number;
}>();

const emit = defineEmits<{
  "update:pricingType": [val: "one_time" | "subscription" | "free"];
  "update:price": [val: number];
  "update:billingPeriod": [val: BillingPeriodType];
  "update:customBillingDays": [val: number];
  "update:hasTrialPeriod": [val: boolean];
  "update:trialPeriodDays": [val: number];
}>();

import { BILLING_PERIOD_OPTIONS as billingPeriodOptions } from "../../constants";

const isBillingPeriodDropdownOpen = ref(false);

const selectedBillingPeriodLabel = computed(() => {
  const opt = billingPeriodOptions.find((o) => o.id === props.billingPeriod);
  return opt ? opt.label : "Monthly";
});

function selectBillingPeriod(id: BillingPeriodType) {
  emit("update:billingPeriod", id);
  isBillingPeriodDropdownOpen.value = false;
}
</script>

<template>
  <div class="space-y-4">
    <div class="border-b border-jetblack/10 pb-3">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-gold"></div>
        <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">Penetapan Harga</h2>
      </div>
      <p class="text-[11px] text-jetblack/60 mt-0.5">
        Atur skema pembayaran langganan berkala, freemium, atau sekali bayar.
      </p>
    </div>

    <!-- Pricing Model Selection Cards -->
    <div class="grid grid-cols-3 gap-2.5">
      <button
        type="button"
        @click="emit('update:pricingType', 'free')"
        :class="[
          'p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer',
          pricingType === 'free'
            ? 'border-jetblack bg-jetblack text-white shadow-xs'
            : 'border-jetblack/15 bg-white text-jetblack hover:border-jetblack/30',
        ]"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold">Gratis</span>
          <div
            class="w-4 h-4 rounded-full border flex items-center justify-center transition"
            :class="
              pricingType === 'free' ? 'border-gold bg-gold text-jetblack' : 'border-jetblack/30'
            "
          >
            <Check v-if="pricingType === 'free'" class="w-2.5 h-2.5 stroke-[3]" />
          </div>
        </div>
        <p
          class="text-[10px]"
          :class="pricingType === 'free' ? 'text-white/70' : 'text-jetblack/60'"
        >
          Freemium atau uji coba tanpa biaya
        </p>
      </button>

      <button
        type="button"
        @click="emit('update:pricingType', 'one_time')"
        :class="[
          'p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer',
          pricingType === 'one_time'
            ? 'border-jetblack bg-jetblack text-white shadow-xs'
            : 'border-jetblack/15 bg-white text-jetblack hover:border-jetblack/30',
        ]"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold">Sekali Bayar</span>
          <div
            class="w-4 h-4 rounded-full border flex items-center justify-center transition"
            :class="
              pricingType === 'one_time'
                ? 'border-gold bg-gold text-jetblack'
                : 'border-jetblack/30'
            "
          >
            <Check v-if="pricingType === 'one_time'" class="w-2.5 h-2.5 stroke-[3]" />
          </div>
        </div>
        <p
          class="text-[10px]"
          :class="pricingType === 'one_time' ? 'text-white/70' : 'text-jetblack/60'"
        >
          Beli putus, lisensi seumur hidup
        </p>
      </button>

      <button
        type="button"
        @click="emit('update:pricingType', 'subscription')"
        :class="[
          'p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer',
          pricingType === 'subscription'
            ? 'border-jetblack bg-jetblack text-white shadow-xs'
            : 'border-jetblack/15 bg-white text-jetblack hover:border-jetblack/30',
        ]"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold">Berlangganan</span>
          <div
            class="w-4 h-4 rounded-full border flex items-center justify-center transition"
            :class="
              pricingType === 'subscription'
                ? 'border-gold bg-gold text-jetblack'
                : 'border-jetblack/30'
            "
          >
            <Check v-if="pricingType === 'subscription'" class="w-2.5 h-2.5 stroke-[3]" />
          </div>
        </div>
        <p
          class="text-[10px]"
          :class="pricingType === 'subscription' ? 'text-white/70' : 'text-jetblack/60'"
        >
          Penagihan berulang otomatis
        </p>
      </button>
    </div>

    <!-- Pricing Inputs -->
    <div v-if="pricingType !== 'free'" class="space-y-3">
      <!-- Base Price -->
      <div>
        <label class="block text-[11px] font-bold text-jetblack/70 mb-1">
          Harga Dasar {{ pricingType === "subscription" ? `(${selectedBillingPeriodLabel})` : "" }}
        </label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-jetblack/40"
            >Rp</span
          >
          <input
            :value="price"
            @input="emit('update:price', Number(($event.target as HTMLInputElement).value) || 0)"
            type="number"
            min="0"
            step="1000"
            placeholder="49000"
            class="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs font-mono font-bold text-jetblack placeholder:text-jetblack/30 focus:outline-none focus:border-gold"
          />
        </div>
      </div>

      <!-- Subscription Options: Billing Period -->
      <div v-if="pricingType === 'subscription'" class="space-y-3">
        <div>
          <label class="block text-[11px] font-bold text-jetblack/70 mb-1">Siklus Penagihan</label>
          <div class="relative">
            <button
              type="button"
              @click="isBillingPeriodDropdownOpen = !isBillingPeriodDropdownOpen"
              class="w-full flex items-center justify-between px-3 py-2 bg-white border border-jetblack/15 rounded-lg text-xs font-medium text-jetblack focus:outline-none focus:border-gold"
            >
              <span>{{ selectedBillingPeriodLabel }}</span>
              <ChevronDown
                class="w-4 h-4 text-jetblack/50 transition-transform duration-200"
                :class="{ 'rotate-180': isBillingPeriodDropdownOpen }"
              />
            </button>

            <!-- Dropdown Menu -->
            <div
              v-if="isBillingPeriodDropdownOpen"
              class="absolute z-10 w-full mt-1 bg-white border border-jetblack/15 rounded-lg shadow-lg overflow-hidden py-1"
            >
              <button
                v-for="opt in billingPeriodOptions"
                :key="opt.id"
                type="button"
                @click="selectBillingPeriod(opt.id)"
                class="w-full text-left px-3 py-1.5 text-xs hover:bg-jetblack/5 transition flex items-center justify-between"
                :class="{ 'font-bold text-gold': billingPeriod === opt.id }"
              >
                <span>{{ opt.label }}</span>
                <Check v-if="billingPeriod === opt.id" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Custom Days Input -->
        <div
          v-if="billingPeriod === 'custom'"
          class="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
        >
          <label class="block text-[11px] font-bold text-jetblack/70"
            >Interval Penagihan Kustom (Hari)</label
          >
          <input
            :value="customBillingDays"
            @input="
              emit(
                'update:customBillingDays',
                Number(($event.target as HTMLInputElement).value) || 1
              )
            "
            type="number"
            min="1"
            max="365"
            class="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-jetblack focus:outline-none focus:border-gold"
          />
        </div>
      </div>
    </div>

    <!-- Free Trial Option (Subscription only) -->
    <div
      v-if="pricingType === 'subscription'"
      class="p-3 rounded-xl bg-jetblack/[0.02] border border-jetblack/10 space-y-2.5"
    >
      <div class="flex items-center justify-between">
        <div>
          <div class="flex items-center gap-1.5">
            <Sparkles class="w-3.5 h-3.5 text-gold" />
            <span class="text-xs font-bold text-jetblack">Uji Coba Gratis (Free Trial)</span>
          </div>
          <p class="text-[10px] text-jetblack/60">
            Pelanggan tidak ditagih hingga masa trial berakhir.
          </p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            :checked="hasTrialPeriod"
            @change="emit('update:hasTrialPeriod', ($event.target as HTMLInputElement).checked)"
            class="sr-only peer"
          />
          <div
            class="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-forest transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white peer-checked:after:bg-white after:rounded-full after:h-4 after:w-4 after:transition peer-checked:after:translate-x-full shadow-inner"
          ></div>
        </label>
      </div>

      <!-- Trial Days Input -->
      <div
        v-if="hasTrialPeriod"
        class="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-jetblack"
      >
        <span class="text-xs text-jetblack/80 font-medium">Durasi uji coba gratis:</span>
        <input
          :value="trialPeriodDays"
          @input="
            emit('update:trialPeriodDays', Number(($event.target as HTMLInputElement).value) || 1)
          "
          type="number"
          min="1"
          class="w-16 px-2 py-1 text-xs text-center font-bold bg-white border border-slate-300 text-jetblack rounded-md focus:outline-none focus:border-gold"
        />
        <span class="text-xs text-jetblack/70 font-medium">hari</span>
      </div>
    </div>
  </div>
</template>
