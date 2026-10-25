<script setup lang="ts">
import { Search, X } from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    dark?: boolean;
    wrapperClass?: string;
    inputClass?: string;
    iconClass?: string;
  }>(),
  {
    placeholder: "Cari...",
    dark: false,
    wrapperClass: "",
    inputClass: "",
    iconClass: "w-3.5 h-3.5",
  }
);

const emit = defineEmits<{
  (e: "update:modelValue", val: string): void;
  (e: "clear"): void;
}>();

function onInput(e: Event) {
  emit("update:modelValue", (e.target as HTMLInputElement).value);
}

function clear() {
  emit("update:modelValue", "");
  emit("clear");
}
</script>

<template>
  <div :class="['relative flex items-center', wrapperClass]">
    <Search
      :class="[
        'absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none',
        iconClass,
        dark ? 'text-white/40' : 'text-jetblack/40',
      ]"
    />
    <input
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      :class="[
        'w-full pl-8 pr-7 py-1.5 text-xs transition focus:outline-none',
        dark
          ? 'bg-white/10 hover:bg-white/15 focus:bg-white/15 border border-white/15 text-white placeholder:text-white/40 focus:border-gold rounded-lg'
          : 'bg-white hover:bg-slate-50 focus:bg-white border border-slate-200/90 text-jetblack placeholder:text-jetblack/40 focus:border-gold rounded-xl shadow-2xs',
        inputClass,
      ]"
      @input="onInput"
    />
    <button
      v-if="modelValue"
      type="button"
      @click="clear"
      :class="[
        'absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded cursor-pointer transition',
        dark ? 'text-white/50 hover:text-white' : 'text-jetblack/40 hover:text-jetblack',
      ]"
      title="Hapus pencarian"
    >
      <X class="w-3 h-3" />
    </button>
  </div>
</template>
