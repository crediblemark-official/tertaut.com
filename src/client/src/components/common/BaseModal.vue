<script setup lang="ts">
import { watch, onMounted, onUnmounted } from "vue";
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

function onKeyDown(e: KeyboardEvent) {
  if (props.show && e.key === "Escape") {
    emit("close");
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
});

watch(
  () => props.show,
  (isShown) => {
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
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-jetblack/60 backdrop-blur-xs"
        @click.self="emit('close')"
        role="dialog"
        aria-modal="true"
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
            v-if="show"
            :class="[
              'relative w-full bg-white rounded-2xl shadow-2xl border border-jetblack/15 overflow-hidden flex flex-col',
              maxWidth,
              cardClass,
            ]"
          >
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
                  @click="emit('close')"
                  class="text-white/50 hover:text-white transition cursor-pointer p-1 rounded-md"
                  title="Tutup (Esc)"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>
            </slot>

            <!-- Body -->
            <div class="flex-1 overflow-y-auto">
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
