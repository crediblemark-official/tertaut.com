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
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
        @click.self="handleCancel"
      >
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-95 translate-y-2"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-2"
        >
          <div
            v-if="isOpen"
            class="relative w-full max-w-md p-6 bg-[#141414] text-white rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] border border-white/10 overflow-hidden ring-1 ring-white/5"
            role="dialog"
            aria-modal="true"
          >
            <!-- Ambient top gradient glow -->
            <div
              class="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-28 rounded-full blur-2xl pointer-events-none"
              :class="{
                'bg-rose-500/15': options.variant === 'danger',
                'bg-amber-500/15': options.variant === 'warning',
                'bg-gold/15': options.variant === 'info',
              }"
            />

            <!-- Close button -->
            <button
              type="button"
              class="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition active:scale-95 cursor-pointer"
              aria-label="Tutup"
              @click="handleCancel"
            >
              <X class="w-4 h-4" />
            </button>

            <div class="flex items-start gap-4">
              <!-- Icon badge -->
              <div
                class="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 transition"
                :class="{
                  'bg-rose-500/10 text-rose-400 border border-rose-500/25 shadow-[0_0_15px_rgba(244,63,94,0.15)]':
                    options.variant === 'danger',
                  'bg-amber-500/10 text-amber-400 border border-amber-500/25 shadow-[0_0_15px_rgba(245,158,11,0.15)]':
                    options.variant === 'warning',
                  'bg-gold/10 text-gold border border-gold/25 shadow-[0_0_15px_rgba(212,175,55,0.15)]':
                    options.variant === 'info',
                }"
              >
                <AlertTriangle v-if="options.variant === 'danger'" class="w-5 h-5" />
                <AlertCircle v-else-if="options.variant === 'warning'" class="w-5 h-5" />
                <Info v-else class="w-5 h-5" />
              </div>

              <!-- Content -->
              <div class="flex-1 pr-4">
                <h3 class="text-base font-bold text-white tracking-tight">
                  {{ options.title }}
                </h3>
                <p
                  class="mt-2 text-xs sm:text-sm text-zinc-300/80 leading-relaxed whitespace-pre-wrap font-normal"
                >
                  {{ options.message }}
                </p>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-white/5">
              <button
                type="button"
                data-action="cancel"
                class="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl border border-white/10 transition active:scale-95 cursor-pointer"
                @click="handleCancel"
              >
                {{ options.cancelText }}
              </button>
              <button
                type="button"
                data-action="confirm"
                class="px-4 py-2 text-xs font-bold rounded-xl transition shadow-md active:scale-95 cursor-pointer"
                :class="{
                  'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40':
                    options.variant === 'danger',
                  'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/40':
                    options.variant === 'warning',
                  'bg-gold hover:bg-gold-hover text-black shadow-amber-950/20':
                    options.variant === 'info',
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
