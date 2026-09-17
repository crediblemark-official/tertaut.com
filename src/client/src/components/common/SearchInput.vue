<template>
  <div class="search-input-wrapper">
    <slot name="icon" />
    <input v-model="query" type="text" :placeholder="placeholder" class="search-input" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
defineProps<{ placeholder?: string }>();
const query = ref("");
</script>

<style scoped>
.search-input-wrapper {
  @apply relative;
}
.search-input {
  @apply pl-8 pr-3 py-1.5 border border-[#111111]/15 rounded-md text-xs w-full;
}
</style>
