<script setup lang="ts">
import type { Component } from "vue";

withDefaults(
  defineProps<{
    label: string;
    value?: string | number;
    sublabel?: string;
    icon?: Component;
    variant?: "default" | "forest" | "gold" | "crimson";
    bordered?: boolean;
    loading?: boolean;
    iconColor?: string;
  }>(),
  {
    value: "",
    sublabel: "",
    variant: "default",
    bordered: false,
    loading: false,
    iconColor: "",
  }
);
</script>

<template>
  <div :class="['space-y-1', bordered && 'sm:border-l sm:border-jetblack/15 sm:pl-5']">
    <!-- Label & Optional Lucide Icon -->
    <div class="flex items-center justify-between text-jetblack/60 text-xs font-semibold">
      <span>{{ label }}</span>
      <component
        v-if="icon"
        :is="icon"
        :class="[
          'w-4 h-4 shrink-0',
          iconColor
            ? iconColor
            : variant === 'forest'
              ? 'text-forest'
              : variant === 'gold'
                ? 'text-gold'
                : variant === 'crimson'
                  ? 'text-crimson'
                  : 'text-jetblack',
        ]"
      />
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="space-y-1.5 py-1">
      <div
        class="h-7 w-28 rounded animate-pulse"
        :class="
          variant === 'forest'
            ? 'bg-forest/15'
            : variant === 'gold'
              ? 'bg-gold/15'
              : variant === 'crimson'
                ? 'bg-crimson/15'
                : 'bg-jetblack/10'
        "
      ></div>
      <div
        class="h-3 w-36 rounded animate-pulse"
        :class="
          variant === 'forest'
            ? 'bg-forest/10'
            : variant === 'gold'
              ? 'bg-gold/10'
              : variant === 'crimson'
                ? 'bg-crimson/10'
                : 'bg-jetblack/5'
        "
      ></div>
    </div>

    <!-- Value & Sublabel -->
    <template v-else>
      <div
        class="text-2xl font-black font-mono tracking-tight"
        :class="
          variant === 'forest'
            ? 'text-forest'
            : variant === 'gold'
              ? 'text-gold'
              : variant === 'crimson'
                ? 'text-crimson'
                : 'text-jetblack'
        "
      >
        <slot name="value">
          {{ value }}
        </slot>
      </div>

      <div class="text-[11px] text-jetblack/50 font-medium">
        <slot name="sublabel">
          {{ sublabel }}
        </slot>
      </div>
    </template>
  </div>
</template>
