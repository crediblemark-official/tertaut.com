<script setup lang="ts">
import { Lock, KeyRound, Power } from 'lucide-vue-next'
import type { VaultCredentialItem, AiProvider } from '../../types'
import { formatRupiah } from '../../lib/utils'

defineProps<{
  vaultCreds: VaultCredentialItem[]
  isSavingKey: boolean
}>()

const newProvider = defineModel<AiProvider>('provider', { default: 'gemini' })
const newRawKey = defineModel<string>('rawKey', { default: '' })
const newBudget = defineModel<number>('budget', { default: 500000 })

const emit = defineEmits<{
  (e: 'save'): void
  (e: 'toggleKillSwitch', cred: VaultCredentialItem): void
}>()
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#111111]/10 border-t border-b border-[#111111]/10 py-6">
    <!-- Form Input Vault Key -->
    <div class="pb-6 lg:pb-0 pr-0 lg:pr-6 space-y-4">
      <h2 class="text-sm font-bold text-[#111111]">Simpan / Perbarui Kredensial AI di Vault</h2>

      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-bold text-[#111111]/70 mb-1">Penyedia AI (Provider)</label>
          <select
            v-model="newProvider"
            class="w-full bg-[#111111]/5 border border-[#111111]/10 rounded-lg p-2 text-[#111111] font-bold focus:outline-none focus:bg-white focus:border-[#D4AF37] transition"
          >
            <option value="gemini">Google Gemini (Default)</option>
            <option value="openai">OpenAI (GPT-4o / Mini)</option>
            <option value="anthropic">Anthropic (Claude 3.5)</option>
          </select>
        </div>

        <div>
          <label class="block font-bold text-[#111111]/70 mb-1">API Key Rahasia (Akan dienkripsi AES-256-GCM)</label>
          <input
            v-model="newRawKey"
            type="password"
            placeholder="sk-ant-... atau AIzaSy..."
            class="w-full bg-[#111111]/5 border border-[#111111]/10 rounded-lg p-2 text-[#111111] font-mono focus:outline-none focus:bg-white focus:border-[#D4AF37] transition"
          />
        </div>

        <div>
          <label class="block font-bold text-[#111111]/70 mb-1">Batas Anggaran Bulanan (Monthly Budget Limit - IDR)</label>
          <input
            v-model.number="newBudget"
            type="number"
            step="50000"
            class="w-full bg-[#111111]/5 border border-[#111111]/10 rounded-lg p-2 text-[#111111] font-mono focus:outline-none focus:bg-white focus:border-[#D4AF37] transition"
          />
        </div>

        <button
          @click="emit('save')"
          :disabled="isSavingKey || !newRawKey"
          class="w-full py-2.5 rounded-lg btn-gold text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <Lock class="w-3.5 h-3.5" />
          <span>{{ isSavingKey ? 'Mengenkripsi & Menyimpan...' : 'Enkripsi & Simpan ke Vault' }}</span>
        </button>
      </div>
    </div>

    <!-- Active Vault Status & Kill Switch -->
    <div class="pt-6 lg:pt-0 pl-0 lg:pl-6 space-y-4">
      <h2 class="text-sm font-bold text-[#111111]">Status Vault &amp; Tombol Darurat (Kill Switch)</h2>

      <div
        v-if="vaultCreds.length === 0"
        class="h-48 flex flex-col items-center justify-center text-center text-[#111111]/40 p-4 border border-dashed border-[#111111]/15 rounded-xl"
      >
        <KeyRound class="w-8 h-8 mb-1.5 opacity-30" />
        <p class="text-xs">Belum ada API Key tersimpan untuk aplikasi ini. Masukkan key di samping.</p>
      </div>

      <div v-else class="divide-y divide-[#111111]/10">
        <div
          v-for="cred in vaultCreds"
          :key="cred.id"
          class="py-3 flex items-center justify-between gap-3 text-xs"
        >
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="font-extrabold uppercase text-[#111111]">{{ cred.provider }}</span>
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="cred.isKillSwitchActive ? 'bg-[#8B0000]/10 text-[#8B0000]' : 'bg-[#0F4C3A]/10 text-[#0F4C3A]'"
              >
                {{ cred.isKillSwitchActive ? 'SHIELD BLOCKED (KILL-SWITCH ON)' : 'AKTIF & AMAN' }}
              </span>
            </div>
            <div class="text-[11px] text-[#111111]/60">
              Pemakaian: <span class="font-mono font-bold text-[#111111]">{{ formatRupiah(cred.currentMonthlyUsage || 0) }}</span> /
              Batas: <span class="font-mono font-bold text-[#111111]">{{ formatRupiah(cred.monthlyBudgetLimit) }}</span>
            </div>
          </div>

          <button
            @click="emit('toggleKillSwitch', cred)"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
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
