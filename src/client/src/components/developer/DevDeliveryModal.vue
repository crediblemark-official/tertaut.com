<script setup lang="ts">
import { Radio, RefreshCw } from "lucide-vue-next";
import BaseModal from "../common/BaseModal.vue";
import StatusBadge from "../common/StatusBadge.vue";
import CopyButton from "../common/CopyButton.vue";

defineProps<{
  isOpen: boolean;
  delivery: any | null;
  retrying: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "retry", deliveryId: string): void;
}>();
</script>

<template>
  <BaseModal
    :show="isOpen && !!delivery"
    title="Detail Pengiriman Webhook"
    max-width="max-w-xl"
    @close="emit('close')"
  >
    <template #title-icon>
      <Radio class="w-4 h-4 text-forest" />
    </template>

    <div v-if="delivery" class="p-6 space-y-4 text-xs">
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
          <span class="text-[10px] text-jetblack/50 uppercase font-bold block mb-1">Status</span>
          <StatusBadge :status="delivery.status" />
        </div>
        <div>
          <span class="text-[10px] text-jetblack/50 uppercase font-bold block">Percobaan</span>
          <span class="font-bold text-[11px]">{{ delivery.attempts }}x</span>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs font-bold text-jetblack">HTTP Request Payload (JSON)</span>
          <CopyButton
            :text="JSON.stringify(delivery.payload, null, 2)"
            label="Salin JSON"
            :show-label="true"
            button-class="inline-flex items-center gap-1 text-[11px] font-bold text-forest hover:underline cursor-pointer"
            icon-class="w-3 h-3"
          />
        </div>
        <pre
          class="p-3 rounded-lg bg-jetblack text-neutral-100 font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed border border-jetblack/20"
          >{{ JSON.stringify(delivery.payload, null, 2) }}</pre>
      </div>
    </div>

    <template #footer>
      <div v-if="delivery" class="flex items-center justify-between">
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
    </template>
  </BaseModal>
</template>
