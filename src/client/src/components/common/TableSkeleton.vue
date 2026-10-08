<script setup lang="ts">
withDefaults(
  defineProps<{
    columns: number;
    rows?: number;
  }>(),
  {
    rows: 5,
  }
);
</script>

<template>
  <tr
    v-for="r in rows"
    :key="r"
    class="animate-pulse border-b border-jetblack/10 last:border-b-0 hover:bg-transparent"
  >
    <td
      v-for="c in columns"
      :key="c"
      class="py-3 px-3 first:pl-3.5 first:sm:pl-4 first:md:pl-6 last:pr-3.5 last:sm:pr-4 last:md:pr-6"
    >
      <div
        class="h-3.5 bg-jetblack/8 rounded"
        :style="{
          width: c === 1 ? '65%' : c === columns ? '35%' : `${40 + ((c * 23 + r * 17) % 45)}%`,
        }"
      ></div>
    </td>
  </tr>
</template>
