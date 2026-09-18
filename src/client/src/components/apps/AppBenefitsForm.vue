<script setup lang="ts">
import { ref } from 'vue'
import { Plus, Check, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [val: string[]]
}>()

const newBenefitInput = ref('')

const suggestedBenefits = [
  'Akses source code lengkap',
  'Lisensi komersial software',
  'Update berkala & perbaikan bug',
  'Dukungan teknis prioritas',
  'Kunci lisensi terverifikasi',
  'Akses channel komunitas privat',
]

function addBenefit() {
  const text = newBenefitInput.value.trim()
  if (!text) return
  if (!props.modelValue.includes(text)) {
    emit('update:modelValue', [...props.modelValue, text])
  }
  newBenefitInput.value = ''
}

function addSuggestedBenefit(sug: string) {
  const text = sug.trim()
  if (!props.modelValue.includes(text)) {
    emit('update:modelValue', [...props.modelValue, text])
  }
}

function updateBenefit(index: number, val: string) {
  const updated = [...props.modelValue]
  updated[index] = val
  emit('update:modelValue', updated)
}

function removeBenefit(index: number) {
  const updated = [...props.modelValue]
  updated.splice(index, 1)
  emit('update:modelValue', updated)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between border-b border-[#111111]/10 pb-3">
      <div>
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-[#D4AF37]"></div>
          <h2 class="text-xs font-bold uppercase tracking-wider text-[#111111]">Manfaat Produk (Benefits)</h2>
        </div>
        <p class="text-[11px] text-[#111111]/60 mt-0.5">Daftar poin keuntungan dan fasilitas yang didapatkan pelanggan paska bayar.</p>
      </div>
      <span class="text-[10px] font-bold text-[#111111]/50 font-mono">{{ modelValue.length }} poin</span>
    </div>

    <!-- Input to add new benefit -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <input
          v-model="newBenefitInput"
          type="text"
          @keydown.enter.prevent="addBenefit"
          placeholder="Tambah poin manfaat (contoh: Akses source code lengkap, Dukungan 24/7)..."
          class="w-full px-3 py-2 text-xs bg-white border border-[#111111]/15 rounded-lg text-[#111111] placeholder:text-[#111111]/35 focus:outline-none focus:border-[#D4AF37] transition shadow-2xs"
        />
      </div>
      <button
        type="button"
        @click="addBenefit"
        :disabled="!newBenefitInput.trim()"
        class="px-3.5 py-2 rounded-lg bg-[#111111] hover:bg-[#222222] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0 active:scale-95"
      >
        <Plus class="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Tambah</span>
      </button>
    </div>

    <!-- Quick suggestion pills -->
    <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
      <span class="text-[10px] font-bold text-[#111111]/50 mr-1">Saran Cepat:</span>
      <button
        v-for="sug in suggestedBenefits"
        :key="sug"
        type="button"
        @click="addSuggestedBenefit(sug)"
        :disabled="modelValue.includes(sug)"
        class="text-[10px] px-2 py-0.5 rounded-md bg-[#111111]/5 hover:bg-[#111111]/10 text-[#111111] font-medium transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
      >
        <Plus class="w-2.5 h-2.5" />
        <span>{{ sug }}</span>
      </button>
    </div>

    <!-- Benefits List Items -->
    <div v-if="modelValue.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
      <div
        v-for="(b, idx) in modelValue"
        :key="idx"
        class="group flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white border border-[#111111]/10 hover:border-[#111111]/25 transition shadow-2xs"
      >
        <div class="flex items-center gap-2.5 flex-1 min-w-0">
          <div class="w-5 h-5 rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] flex items-center justify-center shrink-0">
            <Check class="w-3 h-3 stroke-[3]" />
          </div>
          <input
            :value="b"
            @input="updateBenefit(idx, ($event.target as HTMLInputElement).value)"
            type="text"
            class="w-full text-xs font-medium text-[#111111] bg-transparent focus:outline-none focus:bg-slate-50 px-1.5 py-0.5 rounded"
          />
        </div>
        <button
          type="button"
          @click="removeBenefit(idx)"
          class="text-[#111111]/30 hover:text-red-600 transition cursor-pointer p-1 shrink-0"
          title="Hapus manfaat ini"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <div v-else class="p-5 rounded-xl bg-[#111111]/[0.02] border border-[#111111]/10 text-center text-xs text-[#111111]/50">
      Belum ada manfaat yang ditambahkan. Masukkan poin manfaat di atas untuk meyakinkan calon pembeli di halaman checkout.
    </div>
  </div>
</template>
