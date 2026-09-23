import { ref } from "vue";

export function useClipboard(timeout = 2000) {
  const copied = ref(false);
  let timer: any = null;

  async function copy(text: string) {
    if (timer) clearTimeout(timer);
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        navigator.clipboard.writeText
      ) {
        await navigator.clipboard.writeText(text);
        copied.value = true;
        timer = setTimeout(() => {
          copied.value = false;
        }, timeout);
        return true;
      }
      // Fallback for non-secure contexts or legacy browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      if (successful) {
        copied.value = true;
        timer = setTimeout(() => {
          copied.value = false;
        }, timeout);
        return true;
      }
      return false;
    } catch (err) {
      console.warn("Clipboard write failed:", err);
      return false;
    }
  }

  return {
    copied,
    copy,
  };
}
