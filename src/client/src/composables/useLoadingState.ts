import { ref, type Ref } from "vue";

export function useLoadingState() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function withLoading<T>(fn: () => Promise<T>): Promise<T | null> {
    loading.value = true;
    error.value = null;
    try {
      const result = await fn();
      return result;
    } catch (err: any) {
      error.value = err.message || "Terjadi kesalahan";
      return null;
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, withLoading };
}
