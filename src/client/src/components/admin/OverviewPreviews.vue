<script setup lang="ts">
import type { PanelBuilderItem, PanelTransactionItem } from "../../types/panel";

defineProps<{
  builders: PanelBuilderItem[];
  transactions: PanelTransactionItem[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  selectTab: [tab: "builders" | "ledger"];
}>();
</script>

<template>
  <div
    class="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-jetblack/10 border-b border-jetblack/10 pb-6 pt-2"
  >
    <!-- Left Column: Builder Highlights -->
    <div class="lg:pr-6 space-y-3 pb-6 lg:pb-0">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-bold text-jetblack uppercase tracking-wide">
          Builder Terdaftar Terbaru
        </h2>
        <button
          @click="emit('selectTab', 'builders')"
          class="text-[11px] font-bold text-gold hover:underline cursor-pointer"
        >
          Buka Direktori ({{ builders.length }}) →
        </button>
      </div>

      <!-- Loading Skeleton Rows -->
      <div v-if="loading" class="space-y-3 pt-1">
        <div v-for="i in 4" :key="`sb-${i}`" class="flex items-center justify-between py-1">
          <div class="space-y-1">
            <div class="h-3.5 w-28 bg-jetblack/10 rounded animate-pulse"></div>
            <div class="h-2.5 w-36 bg-jetblack/5 rounded animate-pulse"></div>
          </div>
          <div class="space-y-1 text-right">
            <div class="h-3.5 w-20 bg-jetblack/10 rounded animate-pulse ml-auto"></div>
            <div class="h-2.5 w-12 bg-jetblack/5 rounded animate-pulse ml-auto"></div>
          </div>
        </div>
      </div>

      <div v-else class="space-y-2 divide-y divide-jetblack/10">
        <div
          v-for="b in builders.slice(0, 5)"
          :key="b.id"
          class="flex items-center justify-between pt-2 text-xs"
        >
          <div>
            <div class="font-bold text-jetblack">{{ b.name || "Builder" }}</div>
            <div class="text-[10px] text-jetblack/50 font-mono">{{ b.email }}</div>
          </div>
          <div class="text-right">
            <div class="font-mono font-bold text-forest">
              Rp {{ (b.totalGMV || 0).toLocaleString("id-ID") }}
            </div>
            <div class="text-[10px] text-jetblack/50">{{ b.appCount || 0 }} Aplikasi</div>
          </div>
        </div>
        <div v-if="builders.length === 0" class="pt-3 text-xs text-jetblack/40 italic">
          Belum ada builder yang terdaftar.
        </div>
      </div>
    </div>

    <!-- Right Column: Recent Transactions -->
    <div class="lg:pl-6 space-y-3 pt-6 lg:pt-0">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-bold text-jetblack uppercase tracking-wide">
          Transaksi Global Terkini
        </h2>
        <button
          @click="emit('selectTab', 'ledger')"
          class="text-[11px] font-bold text-gold hover:underline cursor-pointer"
        >
          Buka Ledger ({{ transactions.length }}) →
        </button>
      </div>

      <!-- Loading Skeleton Rows -->
      <div v-if="loading" class="space-y-3 pt-1">
        <div v-for="i in 4" :key="`st-${i}`" class="flex items-center justify-between py-1">
          <div class="space-y-1">
            <div class="h-3.5 w-32 bg-jetblack/10 rounded animate-pulse"></div>
            <div class="h-2.5 w-24 bg-jetblack/5 rounded animate-pulse"></div>
          </div>
          <div class="space-y-1 text-right">
            <div class="h-3.5 w-20 bg-jetblack/10 rounded animate-pulse ml-auto"></div>
            <div class="h-2.5 w-14 bg-jetblack/5 rounded animate-pulse ml-auto"></div>
          </div>
        </div>
      </div>

      <div v-else class="space-y-2 divide-y divide-jetblack/10">
        <div
          v-for="t in transactions.slice(0, 5)"
          :key="t.id"
          class="flex items-center justify-between pt-2 text-xs"
        >
          <div>
            <div class="font-mono font-bold text-jetblack truncate max-w-[200px]">
              {{ t.customerEmail }}
            </div>
            <div class="text-[10px] text-jetblack/50 font-mono">{{ t.id }}</div>
          </div>
          <div class="text-right">
            <div class="font-mono font-bold text-jetblack">
              Rp {{ t.grossAmount.toLocaleString("id-ID") }}
            </div>
            <span
              :class="t.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-amber-700'"
              class="text-[10px] font-bold font-mono"
            >
              {{ t.paymentStatus }}
            </span>
          </div>
        </div>
        <div v-if="transactions.length === 0" class="pt-3 text-xs text-jetblack/40 italic">
          Belum ada riwayat transaksi.
        </div>
      </div>
    </div>
  </div>
</template>
