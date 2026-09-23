import { ref, onMounted, type Ref } from "vue";
import { api, clearAppsCache } from "@/lib/api";
import type { AppItem } from "@/types/app";

interface UseAppsReturn {
  appsList: Ref<AppItem[]>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  refetch: () => Promise<void>;
}

export function useApps(mode?: "sandbox" | "live" | "all"): UseAppsReturn {
  const appsList = ref<AppItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchApps(force = false) {
    loading.value = true;
    error.value = null;
    try {
      const res = await api.getApps(mode, force);
      appsList.value = res.apps || [];
    } catch (err: any) {
      error.value = err.message || "Gagal memuat aplikasi";
    } finally {
      loading.value = false;
    }
  }

  async function refetch() {
    clearAppsCache();
    await fetchApps(true);
  }

  onMounted(async () => {
    await fetchApps();
  });

  return { appsList, loading, error, refetch };
}
