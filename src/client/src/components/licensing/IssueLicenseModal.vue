<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { KeyRound, Sparkles } from "lucide-vue-next";
import type { AppItem } from "../../types/app";
import type { LicensePlatform } from "../../types/licensing";
import SearchPicker from "../common/SearchPicker.vue";
import BaseModal from "../common/BaseModal.vue";

const props = defineProps<{
  show: boolean;
  appsList: AppItem[];
  isIssuing: boolean;
  defaultAppId?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (
    e: "issue",
    payload: {
      appId: string;
      customerEmail: string;
      grantDays: number;
      maxSeats: number;
      platform: LicensePlatform;
    }
  ): void;
}>();

const issueAppId = ref(props.defaultAppId || "");
const issueEmail = ref("");
const issueGrantDays = ref(30);
const issueMaxSeats = ref(3);
const issuePlatform = ref<LicensePlatform>("general");

const selectedApp = computed(() => props.appsList.find((a) => a.id === issueAppId.value));

function syncFromApp(app: AppItem | undefined) {
  if (!app) return;
  if (app.deliveryConfig?.licenseKey?.expiresInDays) {
    issueGrantDays.value = Number(app.deliveryConfig.licenseKey.expiresInDays);
  }
  if (app.deliveryConfig?.licenseKey?.maxSeats) {
    issueMaxSeats.value = Number(app.deliveryConfig.licenseKey.maxSeats);
  }
}

watch(
  () => props.defaultAppId,
  (val) => {
    if (val && !issueAppId.value) {
      issueAppId.value = val;
    }
  }
);

watch(
  selectedApp,
  (app) => {
    syncFromApp(app);
  },
  { immediate: true }
);

watch(
  () => props.show,
  (isShown) => {
    if (isShown) {
      syncFromApp(selectedApp.value);
    }
  }
);

function submit() {
  if (!issueEmail.value || !issueAppId.value) return;
  emit("issue", {
    appId: issueAppId.value,
    customerEmail: issueEmail.value,
    grantDays: issueGrantDays.value,
    maxSeats: issueMaxSeats.value,
    platform: issuePlatform.value,
  });
}
</script>

<template>
  <BaseModal
    :show="show"
    title="Terbitkan Lisensi Manual"
    max-width="max-w-sm"
    @close="emit('close')"
  >
    <template #title-icon>
      <KeyRound class="w-4 h-4 text-gold" />
    </template>

    <div class="p-4 space-y-3 text-xs">
      <div>
        <label class="block font-semibold text-[11px] text-jetblack/70 mb-1">Pilih Aplikasi</label>
        <SearchPicker
          v-model="issueAppId"
          :items="appsList"
          placeholder="Pilih aplikasi..."
          search-placeholder="Cari software..."
          button-class="w-full"
        />
      </div>

      <div>
        <label class="block font-semibold text-[11px] text-jetblack/70 mb-1"
          >Email Pembeli / Penerima</label
        >
        <input
          v-model="issueEmail"
          type="email"
          placeholder="customer@example.com"
          class="w-full bg-white border border-jetblack/15 rounded-lg px-2.5 py-1.5 text-xs text-jetblack focus:outline-none focus:border-gold"
        />
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div>
          <label class="block font-semibold text-[11px] text-jetblack/70 mb-1">Masa Aktif</label>
          <input
            v-model.number="issueGrantDays"
            type="number"
            placeholder="30"
            class="w-full bg-white border border-jetblack/15 rounded-lg px-2.5 py-1.5 text-xs text-jetblack font-mono focus:outline-none focus:border-gold"
          />
        </div>
        <div>
          <label class="block font-semibold text-[11px] text-jetblack/70 mb-1">Max Seats</label>
          <input
            v-model.number="issueMaxSeats"
            type="number"
            min="1"
            placeholder="3"
            class="w-full bg-white border border-jetblack/15 rounded-lg px-2.5 py-1.5 text-xs text-jetblack font-mono focus:outline-none focus:border-gold"
          />
        </div>
        <div>
          <label class="block font-semibold text-[11px] text-jetblack/70 mb-1">Platform</label>
          <select
            v-model="issuePlatform"
            class="w-full bg-white border border-jetblack/15 rounded-lg px-2 py-1.5 text-xs text-jetblack focus:outline-none focus:border-gold"
          >
            <option value="general">General</option>
            <option value="desktop">Desktop</option>
            <option value="chrome_extension">Chrome</option>
            <option value="android">Android</option>
            <option value="web">Web</option>
          </select>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          @click="emit('close')"
          class="px-3 py-1.5 rounded-lg bg-jetblack/5 text-xs font-bold text-jetblack hover:bg-jetblack/10 cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          @click="submit"
          :disabled="isIssuing || !issueEmail"
          class="btn-gold px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Sparkles class="w-3.5 h-3.5" />
          <span>{{ isIssuing ? "Menerbitkan..." : "Terbitkan Sekarang" }}</span>
        </button>
      </div>
    </template>
  </BaseModal>
</template>
