<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    page: number;
    totalPages: number;
    total?: number;
    limit?: number;
    loading?: boolean;
    itemLabel?: string;
  }>(),
  {
    total: 0,
    limit: 20,
    loading: false,
    itemLabel: "transaksi",
  }
);

const emit = defineEmits<{
  (e: "update:page", page: number): void;
  (e: "prev"): void;
  (e: "next"): void;
}>();

const fromItem = computed(() => (props.total > 0 ? (props.page - 1) * props.limit + 1 : 0));
const toItem = computed(() => Math.min(props.page * props.limit, props.total));
const safeTotalPages = computed(() => Math.max(1, props.totalPages));

function handlePrev() {
  if (props.page > 1 && !props.loading) {
    emit("update:page", props.page - 1);
    emit("prev");
  }
}

function handleNext() {
  if (props.page < props.totalPages && !props.loading) {
    emit("update:page", props.page + 1);
    emit("next");
  }
}
</script>

<template>
  <div
    class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-2.5 sm:py-3 border-b border-jetblack/15 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs select-none"
  >
    <div class="text-jetblack/60">
      Menampilkan
      <span class="font-semibold text-jetblack">{{ fromItem }}</span>
      -
      <span class="font-semibold text-jetblack">{{ toItem }}</span>
      dari
      <span class="font-semibold text-jetblack">{{ total }}</span>
      {{ itemLabel }}
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        @click="handlePrev"
        :disabled="page <= 1 || loading"
        class="px-3 py-1 sm:py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-jetblack transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        Sebelumnya
      </button>

      <span class="px-2 font-mono font-medium text-jetblack">
        Hal {{ page }} / {{ safeTotalPages }}
      </span>

      <button
        type="button"
        @click="handleNext"
        :disabled="page >= totalPages || loading"
        class="px-3 py-1 sm:py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-jetblack transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        Selanjutnya
      </button>
    </div>
  </div>
</template>
