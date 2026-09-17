<template>
  <div
    class="p-3 rounded-lg border text-xs font-bold flex items-center justify-between"
    :class="typeClass"
  >
    <span>{{ message }}</span>
    <button
      @click="$emit('close')"
      class="ml-2 text-lg leading-none opacity-70 hover:opacity-100 transition cursor-pointer"
      aria-label="Tutup alert"
    >
      &times;
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ message: string; type?: 'success' | 'error' }>()
defineEmits<{ close: [] }>()

const typeClass = computed(() => {
  if (props.type === 'error') return 'bg-red-50 border-red-200 text-red-600'
  return 'bg-[#0F4C3A]/10 border-[#0F4C3A]/25 text-[#0F4C3A]'
})
</script>
