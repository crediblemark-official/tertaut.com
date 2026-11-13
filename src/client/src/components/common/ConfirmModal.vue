<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { AlertTriangle, AlertCircle, Info, X } from "lucide-vue-next";
import { useConfirm } from "../../composables/useConfirm";

const { isOpen, options, handleConfirm, handleCancel } = useConfirm();

function onKeyDown(e: KeyboardEvent) {
  if (!isOpen.value) return;
  if (e.key === "Escape") {
    handleCancel();
  } else if (e.key === "Enter" && !e.shiftKey) {
    const active = document.activeElement;
    if (active && active.getAttribute("data-action") === "cancel") {
      handleCancel();
    } else {
      handleConfirm();
    }
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
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-jetblack/55 backdrop-blur-xs"
        @click.self="handleCancel"
      >
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-[0.98] translate-y-1"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-[0.98] translate-y-1"
        >
          <div
            v-if="isOpen"
            class="w-full max-w-md bg-white text-jetblack border border-jetblack/20 shadow-xl divide-y divide-jetblack/10 overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            <!-- Obsidian Header Bar -->
            <div class="px-4 py-3 bg-jetblack text-white flex items-center justify-between gap-3">
              <div class="flex items-center gap-2 min-w-0">
                <AlertTriangle
                  v-if="options.variant === 'danger'"
                  class="w-4 h-4 text-rose-400 shrink-0"
                />
                <AlertCircle
                  v-else-if="options.variant === 'warning'"
                  class="w-4 h-4 text-amber-400 shrink-0"
                />
                <Info v-else class="w-4 h-4 text-gold shrink-0" />
                <h3 class="text-xs font-bold uppercase tracking-wider text-white truncate">
                  {{ options.title }}
                </h3>
              </div>

              <button
                type="button"
                class="p-1 text-white/60 hover:text-white transition cursor-pointer shrink-0"
                aria-label="Tutup"
                @click="handleCancel"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            <!-- Message Body -->
            <div class="px-5 py-4 bg-white">
              <p
                v-if="options.message"
                class="text-xs text-jetblack/75 leading-relaxed whitespace-pre-wrap"
              >
                {{ options.message }}
              </p>
            </div>

            <!-- Flush Hairline Footer Actions -->
            <div class="grid grid-cols-2 divide-x divide-jetblack/10 bg-jetblack/[0.02]">
              <button
                type="button"
                data-action="cancel"
                class="px-4 py-2.5 text-xs font-bold text-jetblack/70 hover:text-jetblack hover:bg-jetblack/[0.04] transition cursor-pointer"
                @click="handleCancel"
              >
                {{ options.cancelText }}
              </button>
              <button
                type="button"
                data-action="confirm"
                class="px-4 py-2.5 text-xs font-bold transition cursor-pointer"
                :class="{
                  'bg-rose-600 hover:bg-rose-700 text-white': options.variant === 'danger',
                  'bg-forest hover:bg-forest/90 text-white': options.variant === 'warning',
                  'bg-gold hover:bg-gold-muted text-jetblack': options.variant === 'info',
                }"
                @click="handleConfirm"
              >
                {{ options.confirmText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
