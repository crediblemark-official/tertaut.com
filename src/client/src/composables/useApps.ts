import { ref, onMounted, type Ref } from "vue";
import { api } from "@/lib/api";
import type { AppItem } from "@/types/app";

interface UseAppsReturn {
  appsList: Ref<AppItem[]>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  refetch: () => Promise<void>;
}

let cachedApps: AppItem[] | null = null;
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useApps(): UseAppsReturn {
  const appsList = ref<AppItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchApps() {
    loading.value = true;
    error.value = null;
    try {
      const res = await api.getApps();
      appsList.value = res.apps || [];
      cachedApps = appsList.value;
      lastFetch = Date.now();
    } catch (err: any) {
      error.value = err.message || "Gagal memuat aplikasi";
    } finally {
      loading.value = false;
    }
  }

  function getCachedApps(): AppItem[] | null {
    if (cachedApps && Date.now() - lastFetch < CACHE_TTL) {
      return cachedApps;
    }
    return null;
  }

  async function refetch() {
    cachedApps = null;
    await fetchApps();
  }

  onMounted(async () => {
    const cached = getCachedApps();
    if (cached) {
      appsList.value = cached;
    }
    await fetchApps();
  });

  return { appsList, loading, error, refetch };
}
