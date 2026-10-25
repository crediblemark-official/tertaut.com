<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type {
  LicenseConfigItem,
  LicenseItem,
  LicensePlatform,
  SaveLicenseConfigPayload,
} from "../types/licensing";
import { dashboardEnv } from "../lib/environment";
import { CheckCircle2 } from "lucide-vue-next";
import { useLicensing } from "../composables/useLicensing";

import LicenseConfigTable from "../components/licensing/LicenseConfigTable.vue";
import EditLicenseConfigModal from "../components/licensing/EditLicenseConfigModal.vue";
import IssueLicenseModal from "../components/licensing/IssueLicenseModal.vue";
import LicenseActivityPanel from "../components/licensing/LicenseActivityPanel.vue";
import ChangeExpiryModal from "../components/licensing/ChangeExpiryModal.vue";

const route = useRoute();
const router = useRouter();

const selectedAppId = ref<string>("");

const {
  appsList,
  configsList,
  licensesList,
  loadingData,
  actionFeedback,
  loadData,
  saveConfig,
  issueLicense,
  revokeLicense,
  reactivateLicense,
  renewExpiry,
  unbindHardware,
  deactivateSeat,
} = useLicensing();

function handleSelectApp(appId: string) {
  selectedAppId.value = appId === "ALL" ? "" : appId;
  router.replace({
    query: {
      ...route.query,
      app_id: selectedAppId.value || undefined,
    },
  });
}

// Activity Panel State
const activeLicense = ref<LicenseItem | null>(null);

// Issue Modal State
const isIssueModalOpen = ref(false);
const isIssuing = ref(false);
const issuePrefillAppId = ref("");

// Edit / Create Config Modal State
const isConfigModalOpen = ref(false);
const editingConfig = ref<LicenseConfigItem | null>(null);
const isSavingConfig = ref(false);

// Change Expiry Modal State
const changeExpiryLicense = ref<LicenseItem | null>(null);
const isChangingExpiry = ref(false);

function openCreateConfig() {
  editingConfig.value = null;
  isConfigModalOpen.value = true;
}

function openEditConfig(config: LicenseConfigItem) {
  editingConfig.value = config;
  isConfigModalOpen.value = true;
}

async function handleSaveConfig(payload: SaveLicenseConfigPayload) {
  isSavingConfig.value = true;
  try {
    const success = await saveConfig(payload);
    if (success) isConfigModalOpen.value = false;
  } finally {
    isSavingConfig.value = false;
  }
}

function openIssueManual(config: LicenseConfigItem) {
  issuePrefillAppId.value = config.appId;
  isIssueModalOpen.value = true;
}

async function handleIssueLicense(payload: {
  appId: string;
  customerEmail: string;
  grantDays: number;
  maxSeats: number;
  platform: LicensePlatform;
}) {
  isIssuing.value = true;
  try {
    const success = await issueLicense(payload);
    if (success) isIssueModalOpen.value = false;
  } finally {
    isIssuing.value = false;
  }
}

function openChangeExpiry(lic: LicenseItem) {
  changeExpiryLicense.value = lic;
}

async function handleSaveExpiry(payload: {
  licenseKey: string;
  additionalDays?: number;
  newExpiresAt?: string | null;
  isLifetime?: boolean;
}) {
  isChangingExpiry.value = true;
  try {
    const success = await renewExpiry(payload);
    if (success) changeExpiryLicense.value = null;
  } finally {
    isChangingExpiry.value = false;
  }
}

function openDetail(lic: LicenseItem) {
  activeLicense.value = lic;
}

function closeDetail() {
  activeLicense.value = null;
}

onMounted(() => {
  if (route.query.app_id) {
    selectedAppId.value = String(route.query.app_id);
  }
  loadData();
});

watch(
  () => route.query,
  (q) => {
    if (q.app_id) selectedAppId.value = String(q.app_id);
  }
);

watch(dashboardEnv, () => {
  loadData();
});
</script>

<template>
  <div class="animate-fadeIn pb-12">
    <!-- Alert Feedback -->
    <div
      v-if="actionFeedback"
      class="mb-3 p-3 rounded-xl bg-forest/10 border border-forest/30 text-forest text-xs font-bold flex items-center gap-2 animate-fadeIn"
    >
      <CheckCircle2 class="w-4 h-4" />
      <span>{{ actionFeedback }}</span>
    </div>

    <!-- MASTER-DETAIL TABLE PENGATURAN LISENSI -->
    <LicenseConfigTable
      :configs="configsList"
      :licenses="licensesList"
      :apps-list="appsList"
      :selected-app-id="selectedAppId"
      :loading="loadingData"
      @select-app="handleSelectApp"
      @refresh="loadData"
      @create-config="openCreateConfig"
      @edit-config="openEditConfig"
      @issue-manual="openIssueManual"
      @change-expiry="openChangeExpiry"
      @revoke="revokeLicense"
      @reactivate="reactivateLicense"
      @unbind-hardware="unbindHardware"
      @detail="openDetail"
    />

    <!-- Create / Edit License Config Modal -->
    <EditLicenseConfigModal
      :show="isConfigModalOpen"
      :config="editingConfig"
      :apps-list="appsList"
      :loading="isSavingConfig"
      @close="isConfigModalOpen = false"
      @save="handleSaveConfig"
    />

    <!-- Issue License Modal Component -->
    <IssueLicenseModal
      :show="isIssueModalOpen"
      :apps-list="appsList"
      :is-issuing="isIssuing"
      :default-app-id="
        issuePrefillAppId || selectedAppId || (appsList.length > 0 ? appsList[0].id : '')
      "
      @close="isIssueModalOpen = false"
      @issue="handleIssueLicense"
    />

    <!-- Change Expiry Modal Component -->
    <ChangeExpiryModal
      :show="!!changeExpiryLicense"
      :license="changeExpiryLicense"
      :loading="isChangingExpiry"
      @close="changeExpiryLicense = null"
      @save="handleSaveExpiry"
    />

    <!-- Activity & Audit Panel -->
    <LicenseActivityPanel
      :license="activeLicense"
      @close="closeDetail"
      @deactivate-seat="deactivateSeat"
      @reactivate="reactivateLicense"
      @change-expiry="openChangeExpiry"
    />
  </div>
</template>
