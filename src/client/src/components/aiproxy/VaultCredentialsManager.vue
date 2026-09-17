<script setup lang="ts">
import { Lock, KeyRound, Power } from 'lucide-vue-next'
import type { VaultCredentialItem, AiProvider } from '../../types/aiproxy'
import type { AppItem } from '../../types/app'
import { formatRupiah } from '../../lib/utils'
import SearchPicker from '../common/SearchPicker.vue'

defineProps<{
  vaultCreds: VaultCredentialItem[]
  isSavingKey: boolean
  appsList?: AppItem[]
}>()

const selectedAppId = defineModel<string>('selectedAppId', { default: '' })
const newProvider = defineModel<AiProvider>('provider', { default: 'gemini' })
const newRawKey = defineModel<string>('rawKey', { default: '' })
const newBudget = defineModel<number>('budget', { default: 500000 })

const emit = defineEmits<{
  (e: 'save'): void
  (e: 'toggleKillSwitch', cred: VaultCredentialItem): void
  (e: 'appChange'): void
}>()
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#111111]/10 border-t border-b border-[#111111]/10 py-6">
    <!-- Form Input Vault Key -->
    <div class="pb-6 lg:pb-0 pr-0 lg:pr-6 space-y-3.5">
      <h2 class="text-sm font-bold text-[#111111]">Simpan / Perbarui Kredensial AI di Vault</h2>

      <div class="space-y-3 text-xs">
        <!-- Target Software Selector -->
        <div v-if="appsList && appsList.length > 0">
          <label class="block font-bold text-[#111111]/70 mb-1">Target Software</label>
          <SearchPicker
            v-model="selectedAppId"
            :items="appsList"
            @change="emit('appChange')"
            placeholder="Pilih software..."
            search-placeholder="Cari software..."
            button-class="w-full !h-9 !rounded-lg justify-between"
          />
        </div>

        <div>
          <label class="block font-bold text-[#111111]/70 mb-1">Penyedia AI (Provider)</label>
          <select
            v-model="newProvider"
            class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-2.5 text-xs text-[#111111] font-bold shadow-2xs focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] focus:outline-none transition"
          >
            <option value="gemini">Google Gemini (Default)</option>
            <option value="openai">OpenAI (GPT-4o / Mini)</option>
            <option value="anthropic">Anthropic (Claude 3.5)</option>
          </select>
        </div>

        <div>
          <label class="block font-bold text-[#111111]/70 mb-1">API Key Rahasia</label>
          <input
            v-model="newRawKey"
            type="password"
            placeholder="sk-ant-... atau AIzaSy..."
            class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs shadow-2xs focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] focus:outline-none text-[#111111] font-mono transition"
          />
        </div>

        <div>
          <label class="block font-bold text-[#111111]/70 mb-1">Batas Anggaran Bulanan (Rp)</label>
          <input
            v-model.number="newBudget"
            type="number"
            step="50000"
            class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs shadow-2xs focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] focus:outline-none text-[#111111] font-mono transition"
          />
        </div>

        <button
          @click="emit('save')"
          :disabled="isSavingKey || !newRawKey"
          class="w-full h-9 rounded-lg btn-gold text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <Lock class="w-3.5 h-3.5" />
          <span>{{ isSavingKey ? 'Mengenkripsi & Menyimpan...' : 'Enkripsi & Simpan ke Vault' }}</span>
        </button>
      </div>
    </div>

    <!-- Active Vault Status & Kill Switch -->
    <div class="pt-6 lg:pt-0 pl-0 lg:pl-6 space-y-3.5">
      <h2 class="text-sm font-bold text-[#111111]">Status Vault &amp; Tombol Darurat</h2>

      <div
        v-if="vaultCreds.length === 0"
        class="h-44 flex flex-col items-center justify-center text-center text-[#111111]/40 p-4 border border-[#111111]/10 rounded-lg"
      >
        <KeyRound class="w-7 h-7 mb-1.5 opacity-25" />
        <p class="text-xs">Belum ada API Key tersimpan untuk aplikasi ini.</p>
      </div>

      <div v-else class="divide-y divide-[#111111]/10">
        <div
          v-for="cred in vaultCreds"
          :key="cred.id"
          class="py-2.5 flex items-center justify-between gap-3 text-xs"
        >
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="font-extrabold uppercase text-[#111111]">{{ cred.provider }}</span>
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="cred.isKillSwitchActive ? 'bg-[#8B0000]/10 text-[#8B0000]' : 'bg-[#0F4C3A]/10 text-[#0F4C3A]'"
              >
                {{ cred.isKillSwitchActive ? 'SHIELD BLOCKED' : 'AKTIF & AMAN' }}
              </span>
            </div>
            <div class="text-[11px] text-[#111111]/60">
              Pemakaian: <span class="font-mono font-bold text-[#111111]">{{ formatRupiah(cred.currentMonthlyUsage || 0) }}</span> /
              Batas: <span class="font-mono font-bold text-[#111111]">{{ formatRupiah(cred.monthlyBudgetLimit) }}</span>
            </div>
          </div>

          <button
            @click="emit('toggleKillSwitch', cred)"
            class="px-3 h-8 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
            :class="cred.isKillSwitchActive ? 'bg-[#0F4C3A] text-white hover:bg-[#0F4C3A]/90' : 'bg-[#8B0000]/10 text-[#8B0000] hover:bg-[#8B0000]/20'"
          >
            <Power class="w-3 h-3" />
            <span>{{ cred.isKillSwitchActive ? 'Buka Blokir' : 'Aktifkan Kill-Switch' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
