<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import type { AppItem } from "../../types/app";
import { dashboardEnv } from "../../lib/environment";
import { useAppForm } from "../../composables/useAppForm";
import { ArrowLeft, AlertCircle } from "lucide-vue-next";

import AppQuickCreateForm from "./AppQuickCreateForm.vue";

const emit = defineEmits<{
  cancel: [];
  created: [app: AppItem];
  updated: [];
  error: [msg: string];
  delete: [app: AppItem];
}>();

const props = defineProps<{
  createFn: (payload: Record<string, any>) => Promise<any>;
  updateFn?: (appId: string, payload: Record<string, any>) => Promise<any>;
  initialApp?: AppItem | null;
}>();

const {
  isEditMode,
  isCreating,
  createError,
  capabilityMode,
  pricingStrategy,
  hasPayment,
  hasLicense,
  newAppName,
  newAppSlug,
  slugManuallyEdited,
  newAppDesc,
  returnUrl,
  pricingType,
  newAppPrice,
  billingPeriod,
  customBillingDays,
  hasTrialPeriod,
  trialPeriodDays,
  billingPeriodDisplay,
  capabilityBadge,
  handleSubmitProduct,
} = useAppForm({
  initialApp: () => props.initialApp,
  createFn: props.createFn,
  updateFn: props.updateFn,
  onCreated: (app) => emit("created", app),
  onUpdated: () => emit("updated"),
});

function handleKeyboardSave(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (!isCreating.value && newAppName.value.trim()) {
      void handleSubmitProduct();
    }
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeyboardSave);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyboardSave);
});
</script>

<template>
  <div>
    <!-- Docked Top Header Strip -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-3.5 border-b border-jetblack/10 bg-white flex flex-wrap items-center justify-between gap-3"
    >
      <div class="flex items-center gap-3 min-w-0">
        <button
          type="button"
          @click="emit('cancel')"
          aria-label="Kembali"
          title="Kembali"
          class="w-9 h-9 border border-jetblack/15 rounded-md flex items-center justify-center text-jetblack/70 hover:text-jetblack hover:bg-jetblack/5 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold transition-all duration-150 cursor-pointer shrink-0"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>

        <div class="flex flex-wrap items-center gap-2 min-w-0">
          <h1 class="text-base sm:text-lg font-extrabold text-jetblack tracking-tight truncate">
            {{ isEditMode ? newAppName || "Edit Project" : "Buat Project" }}
          </h1>
          <span
            class="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider font-bold uppercase border"
            :class="
              (isEditMode && initialApp ? initialApp.mode : dashboardEnv) === 'live'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            "
          >
            {{ isEditMode && initialApp ? initialApp.mode : dashboardEnv }}
          </span>
          <span
            v-if="isEditMode"
            class="px-2 py-0.5 rounded-full text-[10px] font-bold"
            :class="capabilityBadge.cls"
          >
            {{ capabilityBadge.label }}
          </span>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          @click="emit('cancel')"
          class="h-9 px-3.5 rounded-lg border border-jetblack/15 text-xs font-semibold text-jetblack/80 hover:bg-jetblack/5 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold transition-all duration-150 cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          @click="handleSubmitProduct"
          :disabled="isCreating || !newAppName.trim()"
          :title="isEditMode ? 'Simpan (Cmd+S)' : 'Buat (Cmd+S)'"
          class="h-9 px-4 rounded-lg btn-gold text-xs font-bold shadow-2xs hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
        >
          {{
            isEditMode
              ? isCreating
                ? "Menyimpan..."
                : "Simpan"
              : isCreating
                ? "Membuat..."
                : "Buat"
          }}
        </button>
      </div>
    </div>

    <!-- Error Notice (Flush Hairline Strip) -->
    <div
      v-if="createError"
      role="alert"
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2"
    >
      <AlertCircle class="w-4 h-4 shrink-0" />
      <span>{{ createError }}</span>
    </div>

    <!-- UNIFIED FORM (CREATE & EDIT) -->
    <AppQuickCreateForm
      v-model:app-name="newAppName"
      v-model:app-slug="newAppSlug"
      v-model:slug-manually-edited="slugManuallyEdited"
      v-model:capability-mode="capabilityMode"
      v-model:pricing-strategy="pricingStrategy"
      v-model:pricing-type="pricingType"
      v-model:price="newAppPrice"
      v-model:billing-period="billingPeriod"
      v-model:custom-billing-days="customBillingDays"
      v-model:has-trial-period="hasTrialPeriod"
      v-model:trial-period-days="trialPeriodDays"
      v-model:return-url="returnUrl"
      v-model:description="newAppDesc"
      :has-payment="hasPayment"
      :has-license="hasLicense"
      :is-creating="isCreating"
      :can-submit="Boolean(newAppName.trim())"
      :dashboard-env="isEditMode && initialApp ? initialApp.mode : dashboardEnv"
      :billing-period-display="billingPeriodDisplay"
      :is-edit-mode="isEditMode"
      :initial-app="initialApp"
      :action-label="isEditMode ? 'Simpan' : 'Buat'"
      @cancel="emit('cancel')"
      @submit="handleSubmitProduct"
      @delete="emit('delete', $event)"
    />
  </div>
</template>
