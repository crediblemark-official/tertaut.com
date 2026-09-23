<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    status: string;
    size?: "sm" | "md";
  }>(),
  {
    size: "sm",
  }
);

const badgeConfig = computed(() => {
  const s = props.status?.toUpperCase() || "";
  switch (s) {
    case "ACTIVE":
    case "SUCCESS":
    case "LIVE":
      return {
        bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700",
        dot: "bg-emerald-500",
      };
    case "EXPIRED":
    case "REVOKED":
    case "FAILED":
    case "INACTIVE":
      return {
        bg: "bg-rose-500/10 border-rose-500/20 text-rose-700",
        dot: "bg-rose-500",
      };
    case "PENDING":
    case "SANDBOX":
    case "PROCESSING":
      return {
        bg: "bg-amber-500/10 border-amber-500/20 text-amber-800",
        dot: "bg-amber-500 animate-pulse",
      };
    default:
      return {
        bg: "bg-jetblack/5 border-jetblack/15 text-jetblack/70",
        dot: "bg-jetblack/40",
      };
  }
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 font-semibold font-mono rounded-full border tracking-wide transition-colors"
    :class="[badgeConfig.bg, size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs']"
  >
    <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="badgeConfig.dot" />
    <span>{{ status }}</span>
  </span>
</template>
