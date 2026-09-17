export function useErrorHandler(context: string) {
  function handleError(err: any, defaultMsg = "Gagal memuat data") {
    console.error(`[${context}] ${defaultMsg}:`, err);
    return err?.message || defaultMsg;
  }
  return { handleError };
}
