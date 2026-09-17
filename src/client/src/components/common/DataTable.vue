<template>
  <div class="table-wrapper">
    <table class="data-table">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key">{{ col.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="i">
          <td v-for="col in columns" :key="col.key">{{ row[col.key] }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
interface Column {
  key: string;
  label: string;
}
defineProps<{ columns: Column[]; rows: Record<string, any>[] }>();
</script>

<style scoped>
.table-wrapper {
  @apply -mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto;
}
.data-table {
  @apply w-full min-w-full text-left text-xs whitespace-nowrap border-b border-[#111111]/15;
}
</style>
