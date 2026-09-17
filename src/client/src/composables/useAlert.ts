import { ref, onUnmounted } from "vue";

export function useAlert(timeout = 4000) {
  const alertMessage = ref<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function showAlert(msg: string) {
    if (timer) clearTimeout(timer);
    alertMessage.value = msg;
    timer = setTimeout(() => {
      alertMessage.value = null;
      timer = null;
    }, timeout);
  }

  function clearAlert() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    alertMessage.value = null;
  }

  onUnmounted(() => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  });

  return { alertMessage, showAlert, clearAlert };
}
