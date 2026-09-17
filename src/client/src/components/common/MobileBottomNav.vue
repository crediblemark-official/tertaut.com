<template>
  <nav class="mobile-nav">
    <slot />
  </nav>
</template>

<script setup lang="ts">
// Mobile bottom navigation shared across views
</script>

<style scoped>
.mobile-nav {
  @apply fixed bottom-0 left-0 right-0 h-16 pb-[env(safe-area-inset-bottom,0px)] bg-[#FFFFFF]/95 backdrop-blur-md border-t border-[#111111]/10 flex items-center justify-around px-2 z-50;
}
</style>
