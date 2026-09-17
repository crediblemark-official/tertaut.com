<script setup lang="ts">
import { ref, watch } from 'vue'
import { KeyRound, X, Sparkles } from 'lucide-vue-next'
import type { AppItem, LicensePlatform } from '../../types'
import SearchPicker from '../common/SearchPicker.vue'

const props = defineProps<{
  show: boolean
  appsList: AppItem[]
  isIssuing: boolean
  defaultAppId?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'issue', payload: {
    appId: string
    customerEmail: string
    grantDays: number
    maxSeats: number
    platform: LicensePlatform
  }): void
}>()

const issueAppId = ref(props.defaultAppId || '')
const issueEmail = ref('')
const issueGrantDays = ref(30)
const issueMaxSeats = ref(3)
const issuePlatform = ref<LicensePlatform>('general')

watch(() => props.defaultAppId, (val) => {
  if (val && !issueAppId.value) {
    issueAppId.value = val
  }
})

function submit() {
  if (!issueEmail.value || !issueAppId.value) return
  emit('issue', {
    appId: issueAppId.value,
    customerEmail: issueEmail.value,
    grantDays: issueGrantDays.value,
    maxSeats: issueMaxSeats.value,
    platform: issuePlatform.value
  })
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-[#111111]/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-[#111111]/10 animate-fadeIn">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <KeyRound class="w-4 h-4 text-[#D4AF37]" />
          <h3 class="text-sm font-bold text-[#111111]">Terbitkan Lisensi Manual</h3>
        </div>
        <button @click="emit('close')" class="text-[#111111]/40 hover:text-[#111111] cursor-pointer">
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-bold text-[#111111]/70 mb-1">Pilih Aplikasi</label>
          <SearchPicker
            v-model="issueAppId"
            :items="appsList"
            placeholder="Pilih aplikasi..."
            search-placeholder="Cari software..."
            button-class="w-full"
          />
        </div>

        <div>
          <label class="block font-bold text-[#111111]/70 mb-1">Email Pembeli / Penerima</label>
          <input
            v-model="issueEmail"
            type="email"
            placeholder="customer@example.com"
            class="w-full bg-[#FFFFFF] border border-[#111111]/15 rounded-lg p-2 text-[#111111] focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block font-bold text-[#111111]/70 mb-1">Masa Aktif (Hari)</label>
            <input
              v-model.number="issueGrantDays"
              type="number"
              class="w-full bg-[#FFFFFF] border border-[#111111]/15 rounded-lg p-2 text-[#111111] font-mono focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div>
            <label class="block font-bold text-[#111111]/70 mb-1">Max Seats</label>
            <input
              v-model.number="issueMaxSeats"
              type="number"
              min="1"
              class="w-full bg-[#FFFFFF] border border-[#111111]/15 rounded-lg p-2 text-[#111111] font-mono focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div>
            <label class="block font-bold text-[#111111]/70 mb-1">Platform</label>
            <select
              v-model="issuePlatform"
              class="w-full bg-[#FFFFFF] border border-[#111111]/15 rounded-lg p-2 text-[#111111] focus:outline-none focus:border-[#D4AF37]"
            >
              <option value="general">General</option>
              <option value="desktop">Desktop</option>
              <option value="chrome_extension">Chrome Ext</option>
              <option value="android">Android</option>
              <option value="web">Web</option>
            </select>
          </div>
        </div>

        <div class="pt-2 flex justify-end gap-2">
          <button
            @click="emit('close')"
            class="px-3 py-1.5 rounded-lg bg-[#111111]/5 text-xs font-bold text-[#111111] hover:bg-[#111111]/10 cursor-pointer"
          >
            Batal
          </button>
          <button
            @click="submit"
            :disabled="isIssuing || !issueEmail"
            class="btn-gold px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>{{ isIssuing ? 'Menerbitkan...' : 'Terbitkan Sekarang' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
