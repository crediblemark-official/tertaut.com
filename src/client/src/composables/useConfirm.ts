import { ref } from "vue";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

const isOpen = ref(false);
const options = ref<ConfirmOptions>({
  title: "Konfirmasi Tindakan",
  message: "",
  confirmText: "Ya, Lanjutkan",
  cancelText: "Batal",
  variant: "danger",
});

let resolvePromise: ((value: boolean) => void) | null = null;

export function useConfirm() {
  function confirm(opts: string | ConfirmOptions): Promise<boolean> {
    if (typeof opts === "string") {
      options.value = {
        title: "Konfirmasi Tindakan",
        message: opts,
        confirmText: "Lanjutkan",
        cancelText: "Batal",
        variant: "danger",
      };
    } else {
      options.value = {
        title: opts.title || "Konfirmasi Tindakan",
        message: opts.message,
        confirmText: opts.confirmText || "Lanjutkan",
        cancelText: opts.cancelText || "Batal",
        variant: opts.variant || "danger",
      };
    }

    isOpen.value = true;

    return new Promise<boolean>((resolve) => {
      resolvePromise = resolve;
    });
  }

  function handleConfirm() {
    isOpen.value = false;
    if (resolvePromise) {
      resolvePromise(true);
      resolvePromise = null;
    }
  }

  function handleCancel() {
    isOpen.value = false;
    if (resolvePromise) {
      resolvePromise(false);
      resolvePromise = null;
    }
  }

  return {
    isOpen,
    options,
    confirm,
    handleConfirm,
    handleCancel,
  };
}
