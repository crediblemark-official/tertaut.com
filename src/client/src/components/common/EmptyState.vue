<script setup lang="ts">
import type { Component } from "vue";

withDefaults(
  defineProps<{
    icon?: Component;
    title: string;
    description?: string;
    actionText?: string;
    actionIcon?: Component;
    containerClass?: string;
  }>(),
  {
    description: "",
    actionText: "",
    containerClass: "",
  }
);

const emit = defineEmits<{
  (e: "action"): void;
}>();
</script>

<template>
  <div
    :class="[
      'py-8 px-4 text-center rounded-xl border border-dashed border-slate-300 bg-white/60 space-y-1',
      containerClass,
    ]"
  >
    <div
      v-if="icon || $slots.icon"
      class="w-10 h-10 rounded-full bg-gold/15 text-gold flex items-center justify-center mx-auto mb-2.5 shadow-2xs"
    >
      <slot name="icon">
        <component :is="icon" class="w-4 h-4" />
      </slot>
    </div>

    <h4 class="text-xs font-bold text-jetblack">
      <slot name="title">{{ title }}</slot>
    </h4>

    <p
      v-if="description || $slots.description"
      class="text-[11px] text-jetblack/60 max-w-sm mx-auto"
    >
      <slot name="description">{{ description }}</slot>
    </p>

    <slot />

    <div v-if="actionText || $slots.action" class="pt-2">
      <slot name="action">
        <button
          type="button"
          @click="emit('action')"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-jetblack text-white font-bold text-xs shadow-2xs hover:bg-jetblack/90 transition cursor-pointer"
        >
          <component :is="actionIcon" v-if="actionIcon" class="w-3.5 h-3.5 text-gold" />
          <span>{{ actionText }}</span>
        </button>
      </slot>
    </div>
  </div>
</template>
