<template>
  <span :class="badgeClass">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

defineProps<{ label: string; status?: string }>();
const badgeClass = computed(() => {
  const base = "px-2 py-0.5 rounded-full text-[10px] font-bold";
  return base;
});
</script>
