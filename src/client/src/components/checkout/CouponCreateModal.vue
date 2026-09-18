<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import type { AppItem } from '../../types/app'
import SearchPicker from '../common/SearchPicker.vue'

const props = defineProps<{
  show: boolean
  appsList: AppItem[]
  isCreating: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit'): void
}>()

const form = defineModel<{
  appId: string
  code: string
  discountPercent: number
  maxRedemptions: number
  expiresAt: string
}>('form', { required: true })

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.show) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      @click.self="emit('close')"
    >
      <div class="bg-white border border-[#111111]/20 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 relative animate-scaleIn">
        <!-- Modal Header -->
        <div class="flex items-center justify-between pb-3 border-b border-[#111111]/10">
          <div class="flex items-center gap-2.5">
            <div class="p-2 rounded-xl bg-[#D4AF37]/15 text-[#111111]">
              <Plus class="w-4 h-4 text-[#D4AF37] stroke-[3]" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-[#111111]">Buat Kupon Baru</h3>
              <p class="text-[11px] text-[#111111]/60">Terbitkan kupon diskon untuk software Anda.</p>
            </div>
          </div>
          <button
            type="button"
            @click="emit('close')"
            class="p-1.5 rounded-lg text-slate-400 hover:text-[#111111] hover:bg-slate-100 transition cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Modal Body Form -->
        <form @submit.prevent="emit('submit')" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-bold text-[#111111]/70 mb-1">Target Aplikasi</label>
            <SearchPicker
              v-model="form.appId"
              :items="appsList"
              placeholder="Pilih software..."
              search-placeholder="Cari software..."
              button-class="w-full !h-9 !rounded-lg !min-w-0 justify-between px-3 text-xs border-slate-300/80 hover:border-slate-400 bg-white shadow-2xs focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37]"
            />
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="block font-bold text-[#111111]/70 mb-1">Kode Kupon</label>
              <input
                v-model="form.code"
                type="text"
                placeholder="PROMO50"
                required
                class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs font-mono font-bold uppercase text-[#111111] placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] shadow-2xs transition"
              />
            </div>
            <div>
              <label class="block font-bold text-[#111111]/70 mb-1">Diskon (%)</label>
              <input
                v-model.number="form.discountPercent"
                type="number"
                min="1"
                max="100"
                required
                class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs font-mono text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] shadow-2xs transition"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="block font-bold text-[#111111]/70 mb-1">Kuota Penebusan (0 = ∞)</label>
              <input
                v-model.number="form.maxRedemptions"
                type="number"
                min="0"
                placeholder="0 untuk tanpa batas"
                class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs font-mono text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] shadow-2xs transition"
              />
            </div>
            <div>
              <label class="block font-bold text-[#111111]/70 mb-1">Kedaluwarsa (Opsional)</label>
              <input
                v-model="form.expiresAt"
                type="datetime-local"
                class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-2 text-xs text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] shadow-2xs transition"
              />
            </div>
          </div>

          <!-- Modal Footer Actions -->
          <div class="pt-3 flex items-center justify-end gap-2 border-t border-[#111111]/10">
            <button
              type="button"
              @click="emit('close')"
              class="px-4 h-9 rounded-lg border border-slate-300/80 hover:bg-slate-100 text-xs font-bold text-[#111111] transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              :disabled="isCreating || !form.appId || !form.code.trim()"
              class="px-5 h-9 btn-gold rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 transition shadow-2xs"
            >
              <Plus class="w-3.5 h-3.5 stroke-[3]" />
              <span>{{ isCreating ? 'Menyimpan...' : 'Terbitkan Kupon' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
