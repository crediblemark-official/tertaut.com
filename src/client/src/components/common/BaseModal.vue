<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import { X } from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    show: boolean;
    title?: string;
    maxWidth?: string;
    showClose?: boolean;
    cardClass?: string;
  }>(),
  {
    title: "",
    maxWidth: "max-w-md",
    showClose: true,
    cardClass: "",
  }
);

const emit = defineEmits<{
  (e: "close"): void;
}>();

const dragOffsetY = ref(0);
let touchStartY = 0;

function onKeyDown(e: KeyboardEvent) {
  if (props.show && e.key === "Escape") {
    emit("close");
  }
}

function onTouchStart(e: TouchEvent) {
  touchStartY = e.touches[0]?.clientY ?? 0;
  dragOffsetY.value = 0;
}

function onTouchMove(e: TouchEvent) {
  const currentY = e.touches[0]?.clientY ?? 0;
  const delta = currentY - touchStartY;
  if (delta > 0) {
    dragOffsetY.value = delta;
  }
}

function onTouchEnd() {
  if (dragOffsetY.value > 90) {
    emit("close");
  }
  dragOffsetY.value = 0;
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  document.body.classList.remove("overflow-hidden");
});

watch(
  () => props.show,
  (isShown) => {
    dragOffsetY.value = 0;
    if (isShown) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
  }
);
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
        v-if="show"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-jetblack/60 backdrop-blur-xs"
        @click.self="emit('close')"
        role="dialog"
        aria-modal="true"
      >
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 max-sm:translate-y-full sm:scale-95 sm:translate-y-2"
          enter-to-class="opacity-100 translate-y-0 sm:scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0 sm:scale-100"
          leave-to-class="opacity-0 max-sm:translate-y-full sm:scale-95 sm:translate-y-2"
        >
          <div
            v-if="show"
            :style="dragOffsetY > 0 ? { transform: `translateY(${dragOffsetY}px)` } : undefined"
            :class="[
              'relative w-full bg-white shadow-2xl border border-jetblack/15 overflow-hidden flex flex-col',
              'max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:max-h-[90dvh]',
              'sm:rounded-2xl sm:max-h-[90vh]',
              maxWidth,
              cardClass,
            ]"
          >
            <!-- Mobile Bottom-Sheet Drag Handle -->
            <div
              class="sm:hidden pt-2.5 pb-1 flex justify-center touch-none cursor-grab"
              @touchstart.passive="onTouchStart"
              @touchmove.passive="onTouchMove"
              @touchend="onTouchEnd"
            >
              <span class="w-10 h-1 rounded-full bg-jetblack/20"></span>
            </div>

            <!-- Header slot or default header -->
            <slot name="header">
              <div
                v-if="title || showClose"
                class="px-5 py-3.5 bg-jetblack text-white flex items-center justify-between gap-3 border-b border-white/10"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <slot name="title-icon" />
                  <h3 class="text-xs font-bold uppercase tracking-wider text-white truncate">
                    {{ title }}
                  </h3>
                </div>
                <button
                  v-if="showClose"
                  type="button"
                  aria-label="Tutup"
                  @click="emit('close')"
                  class="text-white/60 hover:text-white transition cursor-pointer p-1.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  title="Tutup (Esc)"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>
            </slot>

            <!-- Body -->
            <div
              class="flex-1 overflow-y-auto overscroll-contain max-sm:pb-[env(safe-area-inset-bottom,0px)]"
            >
              <slot />
            </div>

            <!-- Footer -->
            <div v-if="$slots.footer" class="px-5 py-3 bg-slate-50 border-t border-slate-200/80">
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
