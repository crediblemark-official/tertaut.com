<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import {
  X,
  Plus,
  Trash2,
  ChevronDown,
  Check,
  Sparkles,
  Zap,
  Cpu,
  Database,
  Users,
} from "lucide-vue-next";

export interface MeteringModalResult {
  template: string;
  name: string;
  aggregation: string;
  eventName: string;
  calculationType: "count" | "sum" | "max" | "unique";
  unitLabel: string;
  filters: Array<{ property: string; value: string }>;
  unitPrice: number;
  metricUnit: string;
  freeAllowance: number;
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    initialTemplateId?: string;
    initialName?: string;
    initialEventName?: string;
    initialCalcType?: "count" | "sum" | "max" | "unique";
    initialUnitLabel?: string;
    initialFilters?: Array<{ property: string; value: string }>;
    initialUnitPrice?: string | number;
    initialMetricUnit?: string;
    initialFreeAllowance?: number;
  }>(),
  {
    initialTemplateId: "llm_tokens",
    initialName: "Token LLM",
    initialEventName: "ai_usage",
    initialCalcType: "count",
    initialUnitLabel: "tokens",
    initialUnitPrice: "20.00",
    initialMetricUnit: "per tokens",
    initialFreeAllowance: 0,
  }
);

const emit = defineEmits<{
  "update:modelValue": [val: boolean];
  apply: [result: MeteringModalResult];
}>();

const isTemplateDropdownOpen = ref(false);
const isCalcDropdownOpen = ref(false);
const isPerDropdownOpen = ref(false);

const selectedTemplateId = ref(props.initialTemplateId);
const meterName = ref(props.initialName);
const meterEventName = ref(props.initialEventName);
const meterCalcType = ref<"count" | "sum" | "max" | "unique">(props.initialCalcType);
const meterUnitLabel = ref(props.initialUnitLabel);
const meterFilters = ref<Array<{ property: string; value: string }>>(
  props.initialFilters ? JSON.parse(JSON.stringify(props.initialFilters)) : []
);

const meteringUnitPrice = ref<string | number>(props.initialUnitPrice);
const meteringMetricUnit = ref(props.initialMetricUnit);
const meteringFreeAllowance = ref<number>(props.initialFreeAllowance);

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      selectedTemplateId.value = props.initialTemplateId;
      meterName.value = props.initialName;
      meterEventName.value = props.initialEventName;
      meterCalcType.value = props.initialCalcType;
      meterUnitLabel.value = props.initialUnitLabel;
      meterFilters.value = props.initialFilters
        ? JSON.parse(JSON.stringify(props.initialFilters))
        : [];
      meteringUnitPrice.value = props.initialUnitPrice;
      meteringMetricUnit.value = props.initialMetricUnit;
      meteringFreeAllowance.value = props.initialFreeAllowance;
      closeAllDropdowns();
    }
  }
);

function closeAllDropdowns() {
  isTemplateDropdownOpen.value = false;
  isCalcDropdownOpen.value = false;
  isPerDropdownOpen.value = false;
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && props.modelValue) {
    if (isTemplateDropdownOpen.value || isCalcDropdownOpen.value || isPerDropdownOpen.value) {
      closeAllDropdowns();
    } else {
      handleClose();
    }
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});

const calcOptions = [
  { id: "count" as const, label: "Hitung", code: "count" },
  { id: "sum" as const, label: "Jumlah", code: "sum" },
  { id: "max" as const, label: "Maksimum", code: "max" },
  { id: "unique" as const, label: "Nilai unik", code: "unique" },
];

const meterTemplates = [
  {
    id: "llm_tokens",
    name: "Token LLM",
    icon: Sparkles,
    eventName: "ai_usage",
    calcType: "count" as const,
    unitLabel: "tokens",
    defaultUnitPrice: "20.00",
    perOptions: ["per tokens", "per 1,000 tokens", "per 1M tokens"],
  },
  {
    id: "api_calls",
    name: "Permintaan API",
    icon: Zap,
    eventName: "api_call",
    calcType: "count" as const,
    unitLabel: "requests",
    defaultUnitPrice: "10.00",
    perOptions: ["per requests", "per 1,000 requests", "per 1M requests"],
  },
  {
    id: "compute_minutes",
    name: "Menit komputasi",
    icon: Cpu,
    eventName: "job_completed",
    calcType: "sum" as const,
    unitLabel: "minutes",
    defaultUnitPrice: "50.00",
    perOptions: ["per minutes", "per 1,000 minutes", "per 1M minutes"],
  },
  {
    id: "storage",
    name: "Penyimpanan",
    icon: Database,
    eventName: "storage_snapshot",
    calcType: "max" as const,
    unitLabel: "GB",
    defaultUnitPrice: "5000.00",
    perOptions: ["per GB", "per 1,000 GB", "per 1M GB"],
  },
  {
    id: "active_seats",
    name: "Kursi aktif",
    icon: Users,
    eventName: "user_active",
    calcType: "unique" as const,
    unitLabel: "seats",
    defaultUnitPrice: "15000.00",
    perOptions: ["per seats", "per 1,000 seats", "per 1M seats"],
  },
  {
    id: "custom",
    name: "Kustom",
    icon: Zap,
    eventName: "custom_event",
    calcType: "count" as const,
    unitLabel: "unit",
    defaultUnitPrice: "100.00",
    perOptions: ["per unit", "per 1,000 unit", "per 1M unit"],
  },
];

const currentCalcOption = computed(() => {
  return calcOptions.find((c) => c.id === meterCalcType.value) || calcOptions[0];
});

const currentTemplateMeta = computed(() => {
  return meterTemplates.find((m) => m.id === selectedTemplateId.value) || meterTemplates[0];
});

const calculatedAggregation = computed(() => {
  const code = currentCalcOption.value.code;
  const event = meterEventName.value.trim() || "event";
  const unit = meterUnitLabel.value.trim() || "unit";
  if (code === "count") {
    return `count on ${event}`;
  }
  return `${code}(${unit}) on ${event}`;
});

const dynamicPerOptions = computed(() => {
  const unit = meterUnitLabel.value.trim() || "unit";
  return [`per ${unit}`, `per 1,000 ${unit}`, `per 1M ${unit}`];
});

function applyTemplate(tplId: string) {
  selectedTemplateId.value = tplId;
  const tpl = meterTemplates.find((t) => t.id === tplId);
  if (!tpl) return;
  meterName.value = tpl.name;
  meterEventName.value = tpl.eventName;
  meterCalcType.value = tpl.calcType;
  meterUnitLabel.value = tpl.unitLabel;
  meteringUnitPrice.value = tpl.defaultUnitPrice;
  meteringMetricUnit.value = tpl.perOptions[0];
  isTemplateDropdownOpen.value = false;
}

function addFilter() {
  meterFilters.value.push({ property: "", value: "" });
}

function removeFilter(index: number) {
  meterFilters.value.splice(index, 1);
}

function handleClose() {
  closeAllDropdowns();
  emit("update:modelValue", false);
}

function handleApply() {
  emit("apply", {
    template: selectedTemplateId.value,
    name: meterName.value.trim() || currentTemplateMeta.value.name,
    aggregation: calculatedAggregation.value,
    eventName: meterEventName.value.trim(),
    calculationType: meterCalcType.value,
    unitLabel: meterUnitLabel.value.trim(),
    filters: meterFilters.value.filter(
      (f) => f.property.trim().length > 0 && f.value.trim().length > 0
    ),
    unitPrice: Number(meteringUnitPrice.value) || 0,
    metricUnit: meteringMetricUnit.value,
    freeAllowance: Number(meteringFreeAllowance.value) || 0,
  });
  handleClose();
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
    @click.self="handleClose"
  >
    <div
      class="bg-white border border-jetblack/15 rounded-2xl w-full max-w-[460px] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-scaleIn"
    >
      <!-- Modal Header (Tertaut Luxury Style) -->
      <div
        class="px-5 py-3.5 border-b border-jetblack/10 flex items-center justify-between bg-white shrink-0"
      >
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-gold"></div>
          <h3 class="text-xs font-bold uppercase tracking-wider text-jetblack">
            Tambah Harga Berbasis Penggunaan
          </h3>
        </div>
        <button
          type="button"
          @click="handleClose"
          class="text-jetblack/40 hover:text-jetblack p-1 -mr-1 rounded-lg hover:bg-jetblack/5 transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Modal Body (Generous, Clean, High-Contrast Tertaut Form) -->
      <div class="px-5 py-4 overflow-y-auto space-y-3.5 custom-modal-scrollbar text-xs">
        <!-- Section: Meter & Template Quick Switcher -->
        <div
          class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
        >
          <div>
            <div class="text-xs font-bold text-jetblack flex items-center gap-1.5">
              <Sparkles class="w-3.5 h-3.5 text-gold" />
              <span>Template Meter</span>
            </div>
            <div class="text-[11px] text-jetblack/55 mt-0.5">
              Pilih template untuk konfigurasi awal.
            </div>
          </div>

          <!-- Compact Template Selector Dropdown -->
          <div class="relative shrink-0">
            <button
              type="button"
              @click="
                isTemplateDropdownOpen = !isTemplateDropdownOpen;
                isCalcDropdownOpen = false;
                isPerDropdownOpen = false;
              "
              class="h-8 px-3 rounded-lg bg-white border border-slate-300 hover:border-gold text-xs font-bold text-jetblack transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <component :is="currentTemplateMeta.icon" class="w-3.5 h-3.5 text-gold shrink-0" />
              <span>{{ currentTemplateMeta.name }}</span>
              <ChevronDown
                class="w-3.5 h-3.5 text-slate-400 transition-transform duration-150"
                :class="{ 'rotate-180': isTemplateDropdownOpen }"
              />
            </button>

            <div
              v-if="isTemplateDropdownOpen"
              @click="isTemplateDropdownOpen = false"
              class="fixed inset-0 z-40"
            ></div>
            <div
              v-if="isTemplateDropdownOpen"
              class="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-1 z-50 animate-fadeIn space-y-0.5"
            >
              <div class="px-2 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Pilih Template
              </div>
              <button
                v-for="tpl in meterTemplates"
                :key="tpl.id"
                type="button"
                @click="applyTemplate(tpl.id)"
                class="w-full px-2.5 py-1.5 text-xs rounded-lg text-left flex items-center justify-between transition cursor-pointer"
                :class="
                  selectedTemplateId === tpl.id
                    ? 'bg-gold/15 text-[#8a6d1f] font-bold'
                    : 'text-jetblack hover:bg-slate-100'
                "
              >
                <div class="flex items-center gap-2 truncate">
                  <component :is="tpl.icon" class="w-3.5 h-3.5 text-gold shrink-0" />
                  <span class="truncate">{{ tpl.name }}</span>
                </div>
                <Check
                  v-if="selectedTemplateId === tpl.id"
                  class="w-3.5 h-3.5 text-gold stroke-[3] shrink-0"
                />
              </button>
            </div>
          </div>
        </div>

        <!-- Field: Nama -->
        <div>
          <label class="block text-xs font-bold text-jetblack mb-1">Nama</label>
          <input
            v-model="meterName"
            type="text"
            placeholder="Token LLM"
            class="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 hover:border-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/20 text-xs font-semibold text-jetblack placeholder:text-slate-400 shadow-2xs outline-none transition"
          />
          <p class="text-[11px] text-jetblack/50 mt-1">
            Ditampilkan pada faktur dan di portal pelanggan.
          </p>
        </div>

        <!-- Field: Acara (Event Name) & Filter -->
        <div>
          <label class="block text-xs font-bold text-jetblack mb-1">Acara</label>
          <input
            v-model="meterEventName"
            type="text"
            placeholder="ai_usage"
            class="w-full h-9 px-3 rounded-lg bg-slate-50/70 border border-slate-300 hover:border-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/20 text-xs font-mono font-bold text-jetblack placeholder:text-slate-400 shadow-2xs outline-none transition"
          />
          <p class="text-[11px] text-jetblack/50 mt-1">
            Harus cocok dengan nama acara yang Anda kirim ke API acara, karakter demi karakter.
          </p>

          <!-- Add Filter Link -->
          <div class="mt-1.5">
            <button
              type="button"
              @click="addFilter"
              class="text-xs font-bold text-[#8a6d1f] hover:text-gold inline-flex items-center gap-1 transition cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Tambah filter</span>
            </button>
          </div>

          <!-- Filter rows if any -->
          <div v-if="meterFilters.length > 0" class="space-y-1.5 mt-2">
            <div
              v-for="(flt, idx) in meterFilters"
              :key="idx"
              class="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200"
            >
              <input
                v-model="flt.property"
                type="text"
                placeholder="properti (mis. model)"
                class="flex-1 h-8 px-2.5 rounded bg-white border border-slate-300 text-xs font-mono font-medium text-jetblack focus:border-gold focus:outline-none"
              />
              <span class="text-slate-400 text-xs font-mono font-bold">=</span>
              <input
                v-model="flt.value"
                type="text"
                placeholder="nilai (mis. gpt-4o)"
                class="flex-1 h-8 px-2.5 rounded bg-white border border-slate-300 text-xs font-mono font-medium text-jetblack focus:border-gold focus:outline-none"
              />
              <button
                type="button"
                @click="removeFilter(idx)"
                class="text-slate-400 hover:text-red-500 transition cursor-pointer p-1"
                title="Hapus filter"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- 2-col row: Hitung penggunaan sebagai & Label unit -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Hitung penggunaan sebagai -->
          <div class="relative">
            <label class="block text-xs font-bold text-jetblack mb-1"
              >Hitung penggunaan sebagai</label
            >
            <button
              type="button"
              @click="
                isCalcDropdownOpen = !isCalcDropdownOpen;
                isTemplateDropdownOpen = false;
                isPerDropdownOpen = false;
              "
              class="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-xs font-medium text-jetblack flex items-center justify-between shadow-2xs transition cursor-pointer text-left"
            >
              <span>{{ currentCalcOption.label }}</span>
              <ChevronDown
                class="w-3.5 h-3.5 text-slate-400 transition-transform duration-150 shrink-0"
                :class="{ 'rotate-180': isCalcDropdownOpen }"
              />
            </button>

            <div
              v-if="isCalcDropdownOpen"
              @click="isCalcDropdownOpen = false"
              class="fixed inset-0 z-40"
            ></div>
            <div
              v-if="isCalcDropdownOpen"
              class="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-1 z-50 animate-fadeIn space-y-0.5"
            >
              <button
                v-for="c in calcOptions"
                :key="c.id"
                type="button"
                @click="
                  meterCalcType = c.id;
                  isCalcDropdownOpen = false;
                "
                class="w-full px-3 py-2 text-xs rounded-lg text-left flex items-center justify-between transition cursor-pointer"
                :class="
                  meterCalcType === c.id
                    ? 'bg-gold/15 text-[#8a6d1f] font-bold'
                    : 'text-jetblack hover:bg-slate-100'
                "
              >
                <span>{{ c.label }}</span>
                <Check v-if="meterCalcType === c.id" class="w-3.5 h-3.5 text-gold stroke-[3]" />
              </button>
            </div>
          </div>

          <!-- Label unit -->
          <div>
            <label class="block text-xs font-bold text-jetblack mb-1">Label unit</label>
            <input
              v-model="meterUnitLabel"
              type="text"
              placeholder="tokens"
              class="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 hover:border-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/20 text-xs font-medium text-jetblack placeholder:text-slate-400 shadow-2xs outline-none transition"
            />
          </div>
        </div>

        <!-- Dynamic Calculation Helper (Clean inline badge) -->
        <div class="text-[11px] text-jetblack/60 flex items-center gap-1.5 px-0.5">
          <span>Laporan</span>
          <code
            class="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-jetblack font-mono font-bold text-[10px]"
            >{{ currentCalcOption.code }}</code
          >
          <span>per pelanggan, per siklus penagihan.</span>
        </div>

        <!-- 2-col row: Harga & Per -->
        <div class="grid grid-cols-2 gap-3 pt-0.5">
          <!-- Harga -->
          <div>
            <label class="block text-xs font-bold text-jetblack mb-1">Harga</label>
            <div class="relative">
              <span
                class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-jetblack/40"
                >Rp</span
              >
              <input
                v-model="meteringUnitPrice"
                type="text"
                placeholder="20.00"
                class="w-full h-9 pl-9 pr-3 rounded-lg bg-white border border-slate-300 hover:border-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/20 text-xs font-mono font-bold text-jetblack shadow-2xs outline-none transition"
              />
            </div>
          </div>

          <!-- Per Dropdown -->
          <div class="relative">
            <label class="block text-xs font-bold text-jetblack mb-1">Per</label>
            <button
              type="button"
              @click="
                isPerDropdownOpen = !isPerDropdownOpen;
                isCalcDropdownOpen = false;
                isTemplateDropdownOpen = false;
              "
              class="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-xs font-medium text-jetblack flex items-center justify-between shadow-2xs transition cursor-pointer text-left"
            >
              <span class="truncate">{{ meteringMetricUnit }}</span>
              <ChevronDown
                class="w-3.5 h-3.5 text-slate-400 transition-transform duration-150 shrink-0"
                :class="{ 'rotate-180': isPerDropdownOpen }"
              />
            </button>

            <div
              v-if="isPerDropdownOpen"
              @click="isPerDropdownOpen = false"
              class="fixed inset-0 z-40"
            ></div>
            <div
              v-if="isPerDropdownOpen"
              class="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-1 z-50 animate-fadeIn space-y-0.5"
            >
              <button
                v-for="unit in dynamicPerOptions"
                :key="unit"
                type="button"
                @click="
                  meteringMetricUnit = unit;
                  isPerDropdownOpen = false;
                "
                class="w-full px-3 py-2 text-xs rounded-lg text-left flex items-center justify-between transition cursor-pointer"
                :class="
                  meteringMetricUnit === unit
                    ? 'bg-gold/15 text-[#8a6d1f] font-bold'
                    : 'text-jetblack hover:bg-slate-100'
                "
              >
                <span class="truncate">{{ unit }}</span>
                <Check
                  v-if="meteringMetricUnit === unit"
                  class="w-3.5 h-3.5 text-gold stroke-[3]"
                />
              </button>
            </div>
          </div>
        </div>

        <!-- Tunjangan gratis -->
        <div>
          <label class="block text-xs font-bold text-jetblack mb-1">Tunjangan gratis</label>
          <input
            v-model.number="meteringFreeAllowance"
            type="number"
            min="0"
            placeholder="0"
            class="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 hover:border-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/20 text-xs font-mono font-bold text-jetblack shadow-2xs outline-none transition"
          />
          <p class="text-[11px] text-jetblack/50 mt-1">
            Unit yang disertakan setiap siklus sebelum penagihan dimulai. Biarkan 0 jika tidak ada.
          </p>
        </div>
      </div>

      <!-- Modal Footer (Clean right-aligned Cancel & btn-gold Tambah harga) -->
      <div
        class="px-5 py-3.5 border-t border-jetblack/10 bg-white shrink-0 flex items-center justify-end gap-2"
      >
        <button
          type="button"
          @click="handleClose"
          class="h-9 px-4 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-jetblack transition cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          @click="handleApply"
          class="h-9 px-4 btn-gold rounded-lg text-xs font-bold transition cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1.5"
        >
          Tambah harga
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-modal-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-modal-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-modal-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(17, 17, 17, 0.15);
  border-radius: 9999px;
}
.custom-modal-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(17, 17, 17, 0.3);
}
</style>
