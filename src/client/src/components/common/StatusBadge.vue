<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    status: string;
    label?: string;
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
    case "AKTIF":
    case "SUCCESS":
    case "LIVE":
    case "PAID":
    case "COMPLETED":
      return {
        bg: "bg-forest/10 border-forest/20 text-forest",
        dot: "bg-forest",
      };
    case "EXPIRED":
    case "REVOKED":
    case "FAILED":
    case "INACTIVE":
    case "NONAKTIF":
    case "SUSPENDED":
    case "DIBEKUKAN":
    case "DIBLOKIR":
    case "BANNED":
    case "CANCELED":
    case "CANCELLED":
    case "REFUNDED":
      return {
        bg: "bg-crimson/10 border-crimson/20 text-crimson",
        dot: "bg-crimson",
      };
    case "PENDING":
    case "SANDBOX":
    case "PROCESSING":
    case "UNPAID":
      return {
        bg: "bg-gold/15 border-gold/30 text-[#8a6d1f]",
        dot: "bg-gold animate-pulse",
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
    <slot>{{ label || status }}</slot>
  </span>
</template>
