<script setup lang="ts">
withDefaults(
  defineProps<{
    columns?: number;
    wrapperClass?: string;
  }>(),
  {
    columns: 4,
    wrapperClass: "",
  }
);
</script>

<template>
  <div
    :class="[
      '-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 grid gap-4 sm:gap-6 py-3 border-b border-jetblack/15 bg-white mb-0',
      columns === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3',
      wrapperClass,
    ]"
  >
    <slot />
  </div>
</template>
