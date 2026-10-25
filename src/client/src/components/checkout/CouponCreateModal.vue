<script setup lang="ts">
import { Plus } from "lucide-vue-next";
import type { AppItem } from "../../types/app";
import SearchPicker from "../common/SearchPicker.vue";
import BaseModal from "../common/BaseModal.vue";

defineProps<{
  show: boolean;
  appsList: AppItem[];
  isCreating: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "submit"): void;
}>();

const form = defineModel<{
  appId: string;
  code: string;
  discountPercent: number;
  maxRedemptions: number;
  expiresAt: string;
}>("form", { required: true });
</script>

<template>
  <BaseModal :show="show" title="Buat Kupon Baru" max-width="max-w-md" @close="emit('close')">
    <template #title-icon>
      <div class="p-1.5 rounded-lg bg-gold/15 text-jetblack">
        <Plus class="w-3.5 h-3.5 text-gold stroke-[3]" />
      </div>
    </template>

    <form @submit.prevent="emit('submit')" class="p-5 space-y-3.5 text-xs">
      <div>
        <label class="block font-bold text-jetblack/70 mb-1">Target Aplikasi</label>
        <SearchPicker
          v-model="form.appId"
          :items="appsList"
          placeholder="Pilih software..."
          search-placeholder="Cari software..."
          button-class="w-full !h-9 !rounded-lg !min-w-0 justify-between px-3 text-xs border-slate-300/80 hover:border-slate-400 bg-white shadow-2xs focus:ring-2 focus:ring-gold/20 focus:border-gold"
        />
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <div>
          <label class="block font-bold text-jetblack/70 mb-1">Kode Kupon</label>
          <input
            v-model="form.code"
            type="text"
            placeholder="PROMO50"
            required
            class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs font-mono font-bold uppercase text-jetblack placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold shadow-2xs transition"
          />
        </div>
        <div>
          <label class="block font-bold text-jetblack/70 mb-1">Diskon (%)</label>
          <input
            v-model.number="form.discountPercent"
            type="number"
            min="1"
            max="100"
            required
            class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs font-mono text-jetblack focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold shadow-2xs transition"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <div>
          <label class="block font-bold text-jetblack/70 mb-1">Kuota Penebusan (0 = ∞)</label>
          <input
            v-model.number="form.maxRedemptions"
            type="number"
            min="0"
            placeholder="0 untuk tanpa batas"
            class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs font-mono text-jetblack focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold shadow-2xs transition"
          />
        </div>
        <div>
          <label class="block font-bold text-jetblack/70 mb-1">Kedaluwarsa (Opsional)</label>
          <input
            v-model="form.expiresAt"
            type="datetime-local"
            class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-2 text-xs text-jetblack focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold shadow-2xs transition"
          />
        </div>
      </div>

      <!-- Modal Footer Actions -->
      <div class="pt-3 flex items-center justify-end gap-2 border-t border-jetblack/10">
        <button
          type="button"
          @click="emit('close')"
          class="px-4 h-9 rounded-lg border border-slate-300/80 hover:bg-slate-100 text-xs font-bold text-jetblack transition cursor-pointer"
        >
          Batal
        </button>
        <button
          type="submit"
          :disabled="isCreating || !form.appId || !form.code.trim()"
          class="px-5 h-9 btn-gold rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 transition shadow-2xs"
        >
          <Plus class="w-3.5 h-3.5 stroke-[3]" />
          <span>{{ isCreating ? "Menyimpan..." : "Terbitkan Kupon" }}</span>
        </button>
      </div>
    </form>
  </BaseModal>
</template>
