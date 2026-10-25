<script setup lang="ts">
import { Copy, Check } from "lucide-vue-next";
import { useClipboard } from "../../composables/useClipboard";

const props = withDefaults(
  defineProps<{
    text: string;
    title?: string;
    buttonClass?: string;
    iconClass?: string;
    label?: string;
    copiedLabel?: string;
    showLabel?: boolean;
  }>(),
  {
    title: "Salin ke clipboard",
    buttonClass: "text-jetblack/40 hover:text-jetblack transition cursor-pointer p-0.5",
    iconClass: "w-3.5 h-3.5",
    label: "Salin",
    copiedLabel: "Tersalin!",
    showLabel: false,
  }
);

const { copy, copied } = useClipboard();

function handleClick(e: MouseEvent) {
  e.stopPropagation();
  copy(props.text);
}
</script>

<template>
  <button
    type="button"
    :class="['inline-flex items-center gap-1', buttonClass]"
    :title="title"
    @click="handleClick"
  >
    <Check v-if="copied" :class="[iconClass, 'text-forest animate-scaleIn']" />
    <Copy v-else :class="iconClass" />
    <span v-if="showLabel" class="text-xs font-semibold">
      {{ copied ? copiedLabel : label }}
    </span>
  </button>
</template>
