<script setup lang="ts">
import { ref, watch } from 'vue'
import { KeyRound, X, Sparkles } from 'lucide-vue-next'
import type { AppItem } from '../../types/app'
import type { LicensePlatform } from '../../types/licensing'
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
  <div v-if="show" class="fixed inset-0 bg-jetblack/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
    <div class="bg-white rounded-xl max-w-sm w-full p-4 shadow-xl space-y-3 border border-jetblack/10 animate-fadeIn">
      <div class="flex items-center justify-between pb-1 border-b border-jetblack/5">
        <div class="flex items-center gap-2">
          <KeyRound class="w-4 h-4 text-gold" />
          <h3 class="text-xs font-bold uppercase tracking-wider text-jetblack">Terbitkan Lisensi Manual</h3>
        </div>
        <button @click="emit('close')" class="text-jetblack/40 hover:text-jetblack cursor-pointer p-0.5">
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="space-y-2.5 text-xs">
        <div>
          <label class="block font-semibold text-[11px] text-jetblack/70 mb-1">Pilih Aplikasi</label>
          <SearchPicker
            v-model="issueAppId"
            :items="appsList"
            placeholder="Pilih aplikasi..."
            search-placeholder="Cari software..."
            button-class="w-full"
          />
        </div>

        <div>
          <label class="block font-semibold text-[11px] text-jetblack/70 mb-1">Email Pembeli / Penerima</label>
          <input
            v-model="issueEmail"
            type="email"
            placeholder="customer@example.com"
            class="w-full bg-white border border-jetblack/15 rounded-lg px-2.5 py-1.5 text-xs text-jetblack focus:outline-none focus:border-gold"
          />
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block font-semibold text-[11px] text-jetblack/70 mb-1">Masa Aktif</label>
            <input
              v-model.number="issueGrantDays"
              type="number"
              placeholder="30"
              class="w-full bg-white border border-jetblack/15 rounded-lg px-2.5 py-1.5 text-xs text-jetblack font-mono focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label class="block font-semibold text-[11px] text-jetblack/70 mb-1">Max Seats</label>
            <input
              v-model.number="issueMaxSeats"
              type="number"
              min="1"
              placeholder="3"
              class="w-full bg-white border border-jetblack/15 rounded-lg px-2.5 py-1.5 text-xs text-jetblack font-mono focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label class="block font-semibold text-[11px] text-jetblack/70 mb-1">Platform</label>
            <select
              v-model="issuePlatform"
              class="w-full bg-white border border-jetblack/15 rounded-lg px-2 py-1.5 text-xs text-jetblack focus:outline-none focus:border-gold"
            >
              <option value="general">General</option>
              <option value="desktop">Desktop</option>
              <option value="chrome_extension">Chrome</option>
              <option value="android">Android</option>
              <option value="web">Web</option>
            </select>
          </div>
        </div>

        <div class="pt-1.5 flex justify-end gap-2 border-t border-jetblack/5">
          <button
            @click="emit('close')"
            class="px-3 py-1.5 rounded-lg bg-jetblack/5 text-xs font-bold text-jetblack hover:bg-jetblack/10 cursor-pointer"
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
