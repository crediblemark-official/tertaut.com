<script setup lang="ts">
withDefaults(
  defineProps<{
    wrapperClass?: string;
    tableClass?: string;
    theadClass?: string;
    tbodyClass?: string;
  }>(),
  {
    wrapperClass: "",
    tableClass: "",
    theadClass: "",
    tbodyClass: "",
  }
);
</script>

<template>
  <div :class="['-mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto top-scrollbar !mt-0', wrapperClass]">
    <table
      :class="[
        'w-full min-w-full text-left text-xs whitespace-nowrap border-b border-jetblack/15',
        tableClass,
      ]"
    >
      <thead
        v-if="$slots.head"
        :class="[
          'border-b border-jetblack/20 text-xs font-semibold text-jetblack/70 bg-white',
          theadClass,
        ]"
      >
        <slot name="head" />
      </thead>
      <tbody :class="['divide-y divide-jetblack/15', tbodyClass]">
        <slot />
      </tbody>
    </table>
  </div>
</template>
