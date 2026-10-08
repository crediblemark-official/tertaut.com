<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, clearAppsCache } from "../lib/api";
import type { AppItem, CatalogKPIStats } from "../types/app";
import { dashboardEnv } from "../lib/environment";
import AppCatalog from "../components/apps/AppCatalog.vue";
import AppCreateForm from "../components/apps/AppCreateForm.vue";

const route = useRoute();
const router = useRouter();

const appsList = ref<AppItem[]>([]);
const catalogStats = ref<CatalogKPIStats | null>(null);
const loading = ref(true);
const searchQuery = ref("");
const viewMode = ref<"list" | "create">("list");
const editingApp = ref<AppItem | null>(null);

function openCreatePage() {
  editingApp.value = null;
  viewMode.value = "create";
  router.push({ query: { ...route.query, action: "new" } });
}

function openEditPage(app: AppItem) {
  editingApp.value = app;
  viewMode.value = "create";
  router.push({ query: { ...route.query, action: "edit", app_id: app.id } });
}

function closeCreatePage() {
  editingApp.value = null;
  viewMode.value = "list";
  const query = { ...route.query };
  delete query.action;
  delete query.app_id;
  router.push({ query });
}

watch(
  [() => route.query.action, () => route.query.app_id, appsList],
  ([action, appId]) => {
    if (action === "edit" && appId) {
      const match = appsList.value.find((a) => a.id === appId);
      if (match) {
        editingApp.value = match;
        viewMode.value = "create";
        return;
      }
    }
    if (action === "new") {
      editingApp.value = null;
      viewMode.value = "create";
      return;
    }
    if (action !== "edit") {
      viewMode.value = "list";
      editingApp.value = null;
    }
  },
  { immediate: true }
);

async function loadData() {
  loading.value = true;
  try {
    const [appsRes, statsRes] = await Promise.all([
      api.getApps(dashboardEnv.value, true),
      api.getCatalogStats(dashboardEnv.value).catch((err) => {
        console.error("Failed to load catalog stats:", err);
        return null;
      }),
    ]);
    appsList.value = appsRes.apps || [];
    catalogStats.value = statsRes;

    // Refresh editingApp if active
    if (editingApp.value) {
      const found = appsList.value.find((a) => a.id === editingApp.value!.id);
      if (found) editingApp.value = found;
    }
  } catch (err) {
    console.error("Failed to load apps:", err);
  } finally {
    loading.value = false;
  }
}

async function handleCreated() {
  closeCreatePage();
  clearAppsCache();
  await loadData();
}

async function handleUpdated() {
  showSuccess(`Aplikasi "${editingApp.value?.name || ""}" berhasil diperbarui!`);
  clearAppsCache();
  await loadData();
}

async function handleUpdateProduct(appId: string, payload: Record<string, any>) {
  return api.updateApp(appId, payload);
}

const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

function showError(msg: string) {
  errorMessage.value = msg;
  setTimeout(() => {
    errorMessage.value = null;
  }, 5000);
}

function showSuccess(msg: string) {
  successMessage.value = msg;
  setTimeout(() => {
    successMessage.value = null;
  }, 4000);
}

async function handleToggleMode(app: AppItem) {
  const newMode = app.mode === "sandbox" ? "live" : "sandbox";
  try {
    await api.updateAppMode(app.id, newMode);
    clearAppsCache();
    showSuccess(`Aplikasi "${app.name}" berhasil dialihkan ke mode ${newMode.toUpperCase()}`);
    await loadData();
  } catch (err: any) {
    showError("Gagal mengubah mode aplikasi: " + (err?.message || err));
  }
}

async function handleDeleteApp(app: AppItem) {
  const confirmed = confirm(
    `Hapus project "${app.name}" (${app.slug})?\n\nTindakan ini permanen dan akan menghapus semua konfigurasi project ini.`
  );
  if (!confirmed) return;

  try {
    const res = await api.deleteApp(app.id);
    if (res.success) {
      showSuccess(`Project "${app.name}" berhasil dihapus.`);
      if (editingApp.value?.id === app.id) {
        closeCreatePage();
      }
      clearAppsCache();
      await loadData();
    } else {
      showError(res.message || "Gagal menghapus project.");
    }
  } catch (err: any) {
    showError("Gagal menghapus project: " + (err?.message || err));
  }
}

watch(dashboardEnv, () => {
  loadData();
});

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="animate-fadeIn pb-12">
    <!-- Success Notification Toast -->
    <div
      v-if="successMessage"
      class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-xl transition-all"
    >
      <span>{{ successMessage }}</span>
      <button
        type="button"
        @click="successMessage = null"
        class="text-white/80 hover:text-white font-bold ml-2 cursor-pointer"
      >
        ×
      </button>
    </div>

    <!-- Error Notification Toast -->
    <div
      v-if="errorMessage"
      class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-rose-600 text-white text-xs font-semibold rounded-xl shadow-xl transition-all"
    >
      <span>{{ errorMessage }}</span>
      <button
        type="button"
        @click="errorMessage = null"
        class="text-white/80 hover:text-white font-bold ml-2 cursor-pointer"
      >
        ×
      </button>
    </div>

    <!-- ============================================== -->
    <!-- VIEW 1: APP CATALOG LIST (Multi-SaaS Registry) -->
    <!-- ============================================== -->
    <AppCatalog
      v-if="viewMode === 'list'"
      :apps="appsList"
      :stats="catalogStats"
      :loading="loading"
      :search-query="searchQuery"
      @update:search-query="searchQuery = $event"
      @open-create="openCreatePage"
      @toggle-mode="handleToggleMode"
      @edit="openEditPage"
      @delete="handleDeleteApp"
    />

    <!-- ============================================== -->
    <!-- VIEW 2: CLEAN APP FORM (Single Unified Header) -->
    <!-- ============================================== -->
    <AppCreateForm
      v-else-if="viewMode === 'create'"
      :initial-app="editingApp"
      :create-fn="api.createCampaign.bind(api)"
      :update-fn="handleUpdateProduct"
      @cancel="closeCreatePage"
      @created="handleCreated"
      @updated="handleUpdated"
      @delete="handleDeleteApp"
    />
  </div>
</template>
