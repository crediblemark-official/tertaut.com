<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    size?: "xs" | "sm" | "md" | "lg" | "xl";
    withText?: boolean;
    interactive?: boolean;
  }>(),
  {
    size: "md",
    withText: false,
    interactive: false,
  }
);

const iconDimension = computed(() => {
  switch (props.size) {
    case "xs":
      return "w-6 h-6 rounded-md";
    case "sm":
      return "w-7 h-7 rounded-lg";
    case "lg":
      return "w-10 h-10 rounded-xl";
    case "xl":
      return "w-12 h-12 rounded-2xl";
    case "md":
    default:
      return "w-8 h-8 rounded-lg";
  }
});

const textSize = computed(() => {
  switch (props.size) {
    case "xs":
    case "sm":
      return "text-xs";
    case "lg":
      return "text-lg";
    case "xl":
      return "text-xl";
    case "md":
    default:
      return "text-base";
  }
});
</script>

<template>
  <div class="flex items-center gap-2.5" :class="{ 'group cursor-pointer': interactive }">
    <!-- Brand Logo Mark SVG -->
    <div
      class="relative overflow-hidden shrink-0 shadow-md transition-transform duration-200"
      :class="[iconDimension, interactive ? 'group-hover:scale-105' : '']"
    >
      <img
        src="/logo.svg"
        alt="tertaut.com logo"
        class="w-full h-full object-cover select-none pointer-events-none"
        loading="eager"
      />
    </div>

    <!-- Optional Brand Typography -->
    <div v-if="withText" class="flex flex-col">
      <div
        class="font-extrabold tracking-tight text-jetblack flex items-center gap-0.5 font-mono leading-none"
        :class="textSize"
      >
        <span>tertaut</span><span class="text-gold">.com</span>
      </div>
    </div>
  </div>
</template>
