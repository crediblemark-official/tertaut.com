<script setup lang="ts">
withDefaults(
  defineProps<{
    columns?: number;
    wrapperClass?: string;
    borderless?: boolean;
  }>(),
  {
    columns: 4,
    wrapperClass: "",
    borderless: false,
  }
);
</script>

<template>
  <div
    :class="[
      '-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-3 bg-white mb-0 !mt-0',
      borderless ? 'border-b-0' : 'border-b border-jetblack/15',
      'flex overflow-x-auto no-scrollbar sm:grid gap-4 sm:gap-6',
      columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3',
      wrapperClass,
    ]"
  >
    <slot />
  </div>
</template>
