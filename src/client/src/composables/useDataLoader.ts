import { ref, type Ref } from "vue";

interface DataLoaderOptions<T> {
  fetchFn: () => Promise<T>;
  onData?: (data: T) => void;
  onError?: (err: Error) => void;
}

export function useDataLoader<T>(options: DataLoaderOptions<T>) {
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function loadData() {
    loading.value = true;
    error.value = null;
    try {
      const data = await options.fetchFn();
      options.onData?.(data);
      return data;
    } catch (err: any) {
      const msg = err?.message || "Terjadi kesalahan";
      error.value = msg;
      options.onError?.(err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, loadData };
}
