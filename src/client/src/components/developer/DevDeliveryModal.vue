<script setup lang="ts">
import { Radio, Copy, Check, RefreshCw } from "lucide-vue-next";
import { useClipboard } from "../../composables/useClipboard";

defineProps<{
  isOpen: boolean;
  delivery: any | null;
  retrying: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "retry", deliveryId: string): void;
}>();

const { copied, copy: copyClipboard } = useClipboard();
</script>

<template>
  <div
    v-if="isOpen && delivery"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-jetblack/60 backdrop-blur-xs animate-fadeIn"
    @click.self="emit('close')"
  >
    <div
      class="bg-white rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col border border-jetblack/15"
    >
      <div class="flex items-center justify-between border-b border-jetblack/10 pb-3">
        <div class="flex items-center gap-2">
          <Radio class="w-4 h-4 text-emerald-600" />
          <h3 class="text-sm font-bold text-jetblack">Detail Pengiriman Webhook</h3>
        </div>
        <button
          type="button"
          @click="emit('close')"
          class="text-jetblack/40 hover:text-jetblack cursor-pointer font-bold text-base"
        >
          ×
        </button>
      </div>

      <div class="space-y-3 overflow-y-auto flex-1 pr-1 text-xs">
        <div class="grid grid-cols-2 gap-2 p-3 rounded-lg bg-jetblack/5 border border-jetblack/10">
          <div>
            <span class="text-[10px] text-jetblack/50 uppercase font-bold block">Delivery ID</span>
            <span class="font-mono text-jetblack font-bold text-[11px] truncate block">{{
              delivery.id
            }}</span>
          </div>
          <div>
            <span class="text-[10px] text-jetblack/50 uppercase font-bold block">Event</span>
            <span class="font-mono text-jetblack font-bold text-[11px]">{{ delivery.event }}</span>
          </div>
          <div>
            <span class="text-[10px] text-jetblack/50 uppercase font-bold block">Status</span>
            <span
              class="font-bold text-[11px]"
              :class="delivery.status === 'SENT' ? 'text-forest' : 'text-crimson'"
            >
              {{ delivery.status }}
            </span>
          </div>
          <div>
            <span class="text-[10px] text-jetblack/50 uppercase font-bold block">Percobaan</span>
            <span class="font-bold text-[11px]">{{ delivery.attempts }}x</span>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-bold text-jetblack">HTTP Request Payload (JSON)</span>
            <button
              type="button"
              @click="copyClipboard(JSON.stringify(delivery.payload, null, 2))"
              class="inline-flex items-center gap-1 text-[11px] font-bold text-forest hover:underline cursor-pointer"
            >
              <Check v-if="copied" class="w-3 h-3 text-forest stroke-[3]" />
              <Copy v-else class="w-3 h-3" />
              <span>Salin JSON</span>
            </button>
          </div>
          <pre
            class="p-3 rounded-lg bg-jetblack text-neutral-100 font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed border border-jetblack/20"
            >{{ JSON.stringify(delivery.payload, null, 2) }}</pre>
        </div>
      </div>

      <div class="flex items-center justify-between pt-3 border-t border-jetblack/10">
        <button
          type="button"
          :disabled="retrying"
          @click="emit('retry', delivery.id)"
          class="px-3.5 py-1.5 rounded-lg bg-forest text-white hover:bg-forest/90 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': retrying }" />
          <span>Kirim Ulang Sekarang</span>
        </button>
        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-1.5 rounded-lg border border-jetblack/20 text-xs font-bold text-jetblack/70 hover:text-jetblack hover:bg-jetblack/5 cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>
