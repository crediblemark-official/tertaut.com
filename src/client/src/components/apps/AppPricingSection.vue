<script setup lang="ts">
import { ref, computed } from "vue";
import type { BillingPeriodType } from "../../types/app";
import { Sparkles, ChevronDown, Check, ShieldCheck } from "lucide-vue-next";
import { BILLING_PERIOD_OPTIONS as billingPeriodOptions } from "../../constants";
import { MANAGED_PAYMENT_SPLIT } from "../../constants/company";
import { formatRupiah } from "../../lib/utils";

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

const isBillingPeriodDropdownOpen = ref(false);

const simulatedPlatformFee = computed(() =>
  Math.round((Math.max(0, props.price || 0) * MANAGED_PAYMENT_SPLIT.platformFeePercent) / 100)
);
const simulatedNetPayout = computed(
  () => Math.max(0, props.price || 0) - simulatedPlatformFee.value
);

const selectedBillingPeriodLabel = computed(() => {
  const opt = billingPeriodOptions.find((o) => o.id === props.billingPeriod);
  return opt ? opt.label : "Monthly";
});

function selectBillingPeriod(id: BillingPeriodType) {
  emit("update:billingPeriod", id);
  isBillingPeriodDropdownOpen.value = false;
}

const pricingOptions = [
  { id: "free" as const, label: "Gratis", desc: "Freemium tanpa biaya" },
  { id: "one_time" as const, label: "Sekali Bayar", desc: "Beli putus selamanya" },
  { id: "subscription" as const, label: "Berlangganan", desc: "Akses berjangka" },
];
</script>

<template>
  <div class="space-y-4">
    <!-- Pricing Type Segmented Swiss Grid (No 3 Floating Boxes) -->
    <div
      class="grid grid-cols-1 sm:grid-cols-3 border border-jetblack/15 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-jetblack/10 overflow-hidden"
    >
      <button
        v-for="opt in pricingOptions"
        :key="opt.id"
        type="button"
        @click="emit('update:pricingType', opt.id)"
        class="px-3.5 py-2.5 text-left transition-colors flex flex-col justify-between gap-1 cursor-pointer"
        :class="
          pricingType === opt.id
            ? 'bg-jetblack text-white'
            : 'bg-white text-jetblack hover:bg-jetblack/[0.025]'
        "
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-bold">{{ opt.label }}</span>
          <Check v-if="pricingType === opt.id" class="w-3.5 h-3.5 text-gold stroke-[3]" />
        </div>
        <p
          class="text-[10.5px]"
          :class="pricingType === opt.id ? 'text-white/70' : 'text-jetblack/55'"
        >
          {{ opt.desc }}
        </p>
      </button>
    </div>

    <!-- Pricing Inputs -->
    <div v-if="pricingType !== 'free'" class="space-y-3">
      <div>
        <label class="block text-[11px] font-bold text-jetblack/75 mb-1">
          Harga {{ pricingType === "subscription" ? `(${selectedBillingPeriodLabel})` : "" }}
        </label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-jetblack/40">
            Rp
          </span>
          <input
            :value="price"
            @input="emit('update:price', Number(($event.target as HTMLInputElement).value) || 0)"
            type="number"
            min="0"
            step="1000"
            placeholder="49000"
            class="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs font-mono tracking-wider font-bold text-jetblack placeholder:text-jetblack/30 focus:outline-none focus:border-gold"
          />
        </div>

        <!-- Payout Simulation (Inline Hairline Strip) -->
        <div class="mt-2.5 pt-2.5 border-t border-jetblack/10 space-y-2">
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-bold text-emerald-800 flex items-center gap-1.5">
              <ShieldCheck class="w-3.5 h-3.5 text-emerald-600" />
              Simulasi Managed Payment
            </span>
            <span class="font-mono tracking-wider font-bold text-emerald-700">
              {{ MANAGED_PAYMENT_SPLIT.developerSharePercent }}% Net /
              {{ MANAGED_PAYMENT_SPLIT.platformFeePercent }}% Fee
            </span>
          </div>
          <div
            class="grid grid-cols-3 divide-x divide-jetblack/10 border border-jetblack/10 rounded-lg text-[10.5px] bg-jetblack/[0.015]"
          >
            <div class="px-2.5 py-2">
              <div class="text-jetblack/55">Harga</div>
              <div class="font-mono tracking-wider font-bold text-jetblack">
                {{ formatRupiah(Math.max(0, price || 0)) }}
              </div>
            </div>
            <div class="px-2.5 py-2">
              <div class="text-jetblack/55">
                Fee ({{ MANAGED_PAYMENT_SPLIT.platformFeePercent }}%)
              </div>
              <div class="font-mono tracking-wider font-bold text-jetblack/75">
                -{{ formatRupiah(simulatedPlatformFee) }}
              </div>
            </div>
            <div class="px-2.5 py-2">
              <div class="text-jetblack/55">Bersih</div>
              <div class="font-mono tracking-wider font-bold text-emerald-700">
                {{ formatRupiah(simulatedNetPayout) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Billing Period -->
      <div v-if="pricingType === 'subscription'" class="space-y-3">
        <div>
          <label class="block text-[11px] font-bold text-jetblack/75 mb-1">Siklus Penagihan</label>
          <div class="relative">
            <button
              type="button"
              @click="isBillingPeriodDropdownOpen = !isBillingPeriodDropdownOpen"
              class="w-full flex items-center justify-between px-3 py-2 bg-white border border-jetblack/15 rounded-lg text-xs font-medium text-jetblack focus:outline-none focus:border-gold cursor-pointer"
            >
              <span>{{ selectedBillingPeriodLabel }}</span>
              <ChevronDown
                class="w-4 h-4 text-jetblack/50 transition-transform duration-150"
                :class="{ 'rotate-180': isBillingPeriodDropdownOpen }"
              />
            </button>

            <div
              v-if="isBillingPeriodDropdownOpen"
              class="absolute z-10 w-full mt-1 bg-white border border-jetblack/15 rounded-lg shadow-sm overflow-hidden divide-y divide-jetblack/10"
            >
              <button
                v-for="opt in billingPeriodOptions"
                :key="opt.id"
                type="button"
                @click="selectBillingPeriod(opt.id)"
                class="w-full text-left px-3 py-2 text-xs hover:bg-jetblack/5 transition flex items-center justify-between cursor-pointer"
                :class="{ 'font-bold text-gold': billingPeriod === opt.id }"
              >
                <span>{{ opt.label }}</span>
                <Check v-if="billingPeriod === opt.id" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div v-if="billingPeriod === 'custom'" class="pt-2 border-t border-jetblack/10 space-y-1.5">
          <label class="block text-[11px] font-bold text-jetblack/75">Interval Kustom (Hari)</label>
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
            class="w-full px-3 py-1.5 bg-white border border-jetblack/15 rounded-lg text-xs font-mono tracking-wider font-bold text-jetblack focus:outline-none focus:border-gold"
          />
        </div>
      </div>
    </div>

    <!-- Free Trial Option (Hairline Divider) -->
    <div v-if="pricingType === 'subscription'" class="pt-3 border-t border-jetblack/10 space-y-2.5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-1.5 text-xs font-bold text-jetblack">
            <Sparkles class="w-3.5 h-3.5 text-gold" />
            <span>Uji Coba Gratis</span>
          </div>
          <p class="text-[10.5px] text-jetblack/55">Akses trial tanpa tagihan otomatis</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            :checked="hasTrialPeriod"
            @change="emit('update:hasTrialPeriod', ($event.target as HTMLInputElement).checked)"
            class="sr-only peer"
          />
          <div
            class="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-forest transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition peer-checked:after:translate-x-full"
          ></div>
        </label>
      </div>

      <div v-if="hasTrialPeriod" class="flex items-center gap-2 text-xs text-jetblack">
        <span class="text-jetblack/75 font-medium">Durasi trial:</span>
        <input
          :value="trialPeriodDays"
          @input="
            emit('update:trialPeriodDays', Number(($event.target as HTMLInputElement).value) || 1)
          "
          type="number"
          min="1"
          class="w-16 px-2 py-1 text-xs text-center font-mono tracking-wider font-bold bg-white border border-jetblack/15 text-jetblack rounded-lg focus:outline-none focus:border-gold"
        />
        <span class="text-jetblack/65">hari</span>
      </div>
    </div>
  </div>
</template>
