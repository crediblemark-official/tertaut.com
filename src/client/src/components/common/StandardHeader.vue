<template>
  <div class="toolbar">
    <slot name="left" />
    <slot name="right" />
  </div>
</template>

<script setup lang="ts">
// Standard toolbar header shared across views
</script>

<style scoped>
.toolbar {
  @apply min-h-[44px] py-1.5 sm:py-0 bg-[#111111] text-white border-b border-[#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs mb-3 px-3.5 sm:px-4 md:px-6;
}
</style>
