<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { AlertTriangle, AlertCircle, Info, X } from "lucide-vue-next";
import { useConfirm } from "../../composables/useConfirm";

const { isOpen, options, handleConfirm, handleCancel } = useConfirm();

function onKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape" && isOpen.value) {
    handleCancel();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-jetblack/60 backdrop-blur-xs"
        @click.self="handleCancel"
      >
        <div
          class="relative w-full max-w-md p-6 bg-white rounded-2xl shadow-2xl border border-jetblack/10 overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          <!-- Close button -->
          <button
            type="button"
            class="absolute top-4 right-4 p-1.5 rounded-lg text-jetblack/40 hover:text-jetblack hover:bg-jetblack/5 transition"
            @click="handleCancel"
          >
            <X class="w-4 h-4" />
          </button>

          <div class="flex items-start gap-4">
            <!-- Icon -->
            <div
              class="flex items-center justify-center w-11 h-11 rounded-xl shrink-0"
              :class="{
                'bg-rose-100 text-rose-600': options.variant === 'danger',
                'bg-amber-100 text-amber-600': options.variant === 'warning',
                'bg-blue-100 text-blue-600': options.variant === 'info',
              }"
            >
              <AlertTriangle v-if="options.variant === 'danger'" class="w-5 h-5" />
              <AlertCircle v-else-if="options.variant === 'warning'" class="w-5 h-5" />
              <Info v-else class="w-5 h-5" />
            </div>

            <!-- Content -->
            <div class="flex-1 pr-4">
              <h3 class="text-base font-bold text-jetblack">
                {{ options.title }}
              </h3>
              <p class="mt-1.5 text-sm text-jetblack/70 leading-relaxed whitespace-pre-wrap">
                {{ options.message }}
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-jetblack/5">
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold text-jetblack/70 hover:text-jetblack hover:bg-jetblack/5 rounded-xl transition"
              @click="handleCancel"
            >
              {{ options.cancelText }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-xs font-bold rounded-xl transition shadow-xs"
              :class="{
                'bg-rose-600 hover:bg-rose-700 text-white': options.variant === 'danger',
                'bg-amber-600 hover:bg-amber-700 text-white': options.variant === 'warning',
                'bg-jetblack hover:bg-jetblack/90 text-white': options.variant === 'info',
              }"
              @click="handleConfirm"
            >
              {{ options.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
