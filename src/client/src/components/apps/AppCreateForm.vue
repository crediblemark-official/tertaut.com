<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { DeliveryConfig, MeteringConfig, BillingPeriodType } from '../../types/app'
import { dashboardEnv } from '../../lib/environment'
import { ArrowLeft, X } from 'lucide-vue-next'

import AppBenefitsForm from './AppBenefitsForm.vue'
import AppPricingSection from './AppPricingSection.vue'
import AppDeliverySection from './AppDeliverySection.vue'
import AppLivePreviewCard from './AppLivePreviewCard.vue'
import AppMeteringModal, { type MeteringModalResult } from './AppMeteringModal.vue'

const emit = defineEmits<{
  cancel: []
  created: []
  error: [msg: string]
}>()

const props = defineProps<{
  createFn: (payload: Record<string, any>) => Promise<any>
}>()

// Form state
const isCreating = ref(false)
const createError = ref<string | null>(null)

// General Info
const newAppName = ref('')
const newAppSlug = ref('')
const slugManuallyEdited = ref(false)
const newAppDesc = ref('')
const newAppMediaUrl = ref('')

// Pricing
const pricingType = ref<'one_time' | 'subscription' | 'free'>('subscription')
const newAppPrice = ref(49000)
const billingPeriod = ref<BillingPeriodType>('monthly')
const customBillingDays = ref(14)
const hasTrialPeriod = ref(false)
const trialPeriodDays = ref(7)

const billingPeriodDisplay = computed(() => {
  switch (billingPeriod.value) {
    case 'weekly': return '/ Minggu (Weekly)'
    case 'daily': return '/ Hari (Daily)'
    case 'monthly': return '/ Bulan (Monthly)'
    case 'every_3_months': return '/ 3 Bulan (Quarterly)'
    case 'every_6_months': return '/ 6 Bulan (Semi-annual)'
    case 'yearly': return '/ Tahun (Yearly)'
    case 'custom': return `/ ${customBillingDays.value} Hari`
    default: return '/ Bulan'
  }
})

// Benefits
const benefits = ref<string[]>([
  'Akses source code lengkap & dokumentasi',
  'Lisensi komersial software',
  'Update berkala & perbaikan bug',
])

// Checkout & Follow-up
const returnUrl = ref('')
const abandonedCartRecovery = ref(false)
const autoAffiliateRegistration = ref(false)

// Metering (Usage-based pricing)
const meteringEnabled = ref(false)
const isMeteringModalOpen = ref(false)

const meterTemplateId = ref('llm_tokens')
const meterName = ref('Token LLM')
const meterEventName = ref('ai_usage')
const meterCalcType = ref<'count' | 'sum' | 'max' | 'unique'>('count')
const meterUnitLabel = ref('tokens')
const meterFilters = ref<Array<{ property: string; value: string }>>([])
const meteringAggregation = ref('count on ai_usage')
const meteringUnitPrice = ref<string | number>('20.00')
const meteringMetricUnit = ref('per tokens')
const meteringFreeAllowance = ref<number>(0)

watch(newAppName, (val) => {
  if (!slugManuallyEdited.value) {
    newAppSlug.value = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }
})

function handleMeteringApply(result: MeteringModalResult) {
  meteringEnabled.value = true
  meterTemplateId.value = result.template
  meterName.value = result.name
  meterEventName.value = result.eventName
  meterCalcType.value = result.calculationType
  meterUnitLabel.value = result.unitLabel
  meterFilters.value = result.filters
  meteringAggregation.value = result.aggregation
  meteringUnitPrice.value = result.unitPrice
  meteringMetricUnit.value = result.metricUnit
  meteringFreeAllowance.value = result.freeAllowance
}

function removeMetering() {
  meteringEnabled.value = false
}

function resetForm() {
  newAppName.value = ''
  newAppSlug.value = ''
  slugManuallyEdited.value = false
  newAppDesc.value = ''
  newAppMediaUrl.value = ''
  pricingType.value = 'subscription'
  newAppPrice.value = 49000
  billingPeriod.value = 'monthly'
  hasTrialPeriod.value = false
  trialPeriodDays.value = 7
  benefits.value = [
    'Akses source code lengkap & dokumentasi',
    'Lisensi komersial software',
    'Update berkala & perbaikan bug',
  ]
  meteringEnabled.value = false
  meterTemplateId.value = 'llm_tokens'
  meterName.value = 'Token LLM'
  meterEventName.value = 'ai_usage'
  meterCalcType.value = 'count'
  meterUnitLabel.value = 'tokens'
  meterFilters.value = []
  meteringAggregation.value = 'count on ai_usage'
  meteringUnitPrice.value = '20.00'
  meteringMetricUnit.value = 'per tokens'
  meteringFreeAllowance.value = 0
  returnUrl.value = ''
  abandonedCartRecovery.value = false
  autoAffiliateRegistration.value = false
  deliveryConfigState.value = {
    licenseKey: {
      enabled: true,
      description: 'Lisensi Universal Tertaut',
      expiresInDays: 365,
      maxSeats: 3,
    },
  }
  createError.value = null
}

const deliveryConfigState = ref<DeliveryConfig>({
  licenseKey: {
    enabled: true,
    description: 'Lisensi Universal Tertaut',
    expiresInDays: 365,
    maxSeats: 3,
  },
})

async function handleCreateProduct() {
  if (!newAppName.value || !newAppSlug.value) return
  isCreating.value = true
  createError.value = null

  const deliveryConfig: DeliveryConfig = deliveryConfigState.value

  const meteringConfig: MeteringConfig | undefined = meteringEnabled.value
    ? {
        enabled: true,
        template: meterTemplateId.value,
        name: meterName.value,
        aggregation: meteringAggregation.value,
        eventName: meterEventName.value,
        calculationType: meterCalcType.value,
        unitLabel: meterUnitLabel.value,
        filters: meterFilters.value.filter(f => f.property.trim().length > 0 && f.value.trim().length > 0),
        unitPrice: Number(meteringUnitPrice.value) || 0,
        metricUnit: meteringMetricUnit.value,
        freeAllowance: Number(meteringFreeAllowance.value) || 0,
      }
    : undefined

  try {
    const data = await props.createFn({
      name: newAppName.value,
      slug: newAppSlug.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      targetPrice: pricingType.value === 'free' ? 0 : (newAppPrice.value || 0),
      pricingType: pricingType.value,
      billingPeriod: pricingType.value === 'subscription' ? billingPeriod.value : null,
      trialPeriodDays: (pricingType.value === 'subscription' && hasTrialPeriod.value) ? (trialPeriodDays.value || 7) : 0,
      mode: dashboardEnv.value,
      description: newAppDesc.value,
      mediaUrl: newAppMediaUrl.value || null,
      valueProps: benefits.value.filter(b => b.trim().length > 0),
      redirectUrl: returnUrl.value || null,
      deliveryConfig,
      meteringConfig,
    })

    if (data && (data.success || data.app)) {
      resetForm()
      emit('created')
    } else {
      createError.value = data?.error || 'Gagal membuat produk'
    }
  } catch (e: any) {
    createError.value = e?.message || 'Terjadi kesalahan sistem'
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <div class="space-y-6 animate-fadeIn">
    <!-- Top Navigation & Header -->
    <div class="flex items-center justify-between border-b border-[#111111]/10 pb-4">
      <div class="flex items-center gap-3">
        <button
          type="button"
          @click="emit('cancel')"
          class="p-2 rounded-lg bg-white border border-[#111111]/10 hover:bg-[#111111]/5 transition cursor-pointer text-[#111111]"
          title="Kembali ke Daftar Produk"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-base font-bold text-[#111111]">Produk &amp; Akses Baru</h1>
            <span
              class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full"
              :class="dashboardEnv === 'sandbox' ? 'bg-amber-500/15 text-amber-700 border border-amber-500/30' : 'bg-[#0F4C3A]/10 text-[#0F4C3A] border border-[#0F4C3A]/20'"
            >
              Mode {{ dashboardEnv === 'sandbox' ? 'Sandbox' : 'Live' }}
            </span>
          </div>
          <p class="text-xs text-[#111111]/60">Konfigurasi produk digital, SaaS, atau paywall API dengan Merchant of Record Tertaut.</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="emit('cancel')"
          class="px-3.5 py-1.5 rounded-lg border border-[#111111]/15 text-xs font-semibold text-[#111111]/80 hover:text-[#111111] hover:bg-[#111111]/5 transition cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          @click="handleCreateProduct"
          :disabled="isCreating || !newAppName || !newAppSlug"
          class="px-4 py-1.5 rounded-lg btn-gold text-xs font-bold transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 active:scale-95"
        >
          <span>{{ isCreating ? 'Menerbitkan...' : 'Terbitkan Produk' }}</span>
        </button>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="createError" class="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 text-xs flex items-center justify-between">
      <span>{{ createError }}</span>
      <button @click="createError = null" class="text-red-700/60 hover:text-red-700"><X class="w-3.5 h-3.5" /></button>
    </div>

    <!-- Two-column Layout: Form & Live Preview -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left Column: Settings Form -->
      <div class="lg:col-span-8 space-y-6">
        <!-- 1. DETAIL PRODUK -->
        <div class="space-y-4">
          <div class="border-b border-[#111111]/10 pb-3">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-[#D4AF37]"></div>
              <h2 class="text-xs font-bold uppercase tracking-wider text-[#111111]">Detail Produk</h2>
            </div>
            <p class="text-[11px] text-[#111111]/60 mt-0.5">Identitas utama aplikasi atau resource digital yang dijual.</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-[11px] font-bold text-[#111111]/70 mb-1">Nama Produk <span class="text-red-500">*</span></label>
              <input
                v-model="newAppName"
                type="text"
                placeholder="Contoh: SuperPrompt Studio"
                class="w-full px-3 py-2 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] placeholder:text-[#111111]/35 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-[#111111]/70 mb-1">Slug URL <span class="text-red-500">*</span></label>
              <div class="relative">
                <input
                  v-model="newAppSlug"
                  @input="slugManuallyEdited = true"
                  type="text"
                  placeholder="superprompt-studio"
                  class="w-full px-3 py-2 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] font-mono placeholder:text-[#111111]/35 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-[#111111]/70 mb-1">Deskripsi Singkat</label>
            <textarea
              v-model="newAppDesc"
              rows="2"
              placeholder="Jelaskan nilai utama atau fungsi software dalam 1-2 kalimat..."
              class="w-full px-3 py-2 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] placeholder:text-[#111111]/35 focus:outline-none focus:border-[#D4AF37] resize-none"
            ></textarea>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-[#111111]/70 mb-1">URL Ikon / Sampul (Opsional)</label>
            <input
              v-model="newAppMediaUrl"
              type="url"
              placeholder="https://images.unsplash.com/photo-..."
              class="w-full px-3 py-2 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] placeholder:text-[#111111]/35 focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
        </div>

        <!-- 2. MANFAAT PRODUK (BENEFITS) -->
        <AppBenefitsForm v-model="benefits" />

        <!-- 3. PENETAPAN HARGA & METERING -->
        <AppPricingSection
          v-model:pricingType="pricingType"
          v-model:price="newAppPrice"
          v-model:billingPeriod="billingPeriod"
          v-model:customBillingDays="customBillingDays"
          v-model:hasTrialPeriod="hasTrialPeriod"
          v-model:trialPeriodDays="trialPeriodDays"
          :meteringEnabled="meteringEnabled"
          :meterName="meterName"
          :meterAggregation="meteringAggregation"
          :meteringUnitPrice="meteringUnitPrice"
          :meteringMetricUnit="meteringMetricUnit"
          :meteringFreeAllowance="meteringFreeAllowance"
          @openMeteringModal="isMeteringModalOpen = true"
          @removeMetering="removeMetering"
        />

        <!-- 4. PENGIRIMAN DIGITAL (DELIVERY CONFIG) -->
        <AppDeliverySection v-model="deliveryConfigState" />

        <!-- 5. ALUR CHECKOUT & RETENSI -->
        <div class="space-y-4">
          <div class="border-b border-[#111111]/10 pb-3">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-[#D4AF37]"></div>
              <h2 class="text-xs font-bold uppercase tracking-wider text-[#111111]">Alur Checkout &amp; Retensi</h2>
            </div>
            <p class="text-[11px] text-[#111111]/60 mt-0.5">Tautan pengalihan paska bayar dan otomatisasi tindak lanjut calon pembeli.</p>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-[#111111]/70 mb-1">Return / Success URL (Opsional)</label>
            <input
              v-model="returnUrl"
              type="url"
              placeholder="https://aplikasianda.com/welcome?success=true"
              class="w-full px-3 py-2 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] placeholder:text-[#111111]/35 focus:outline-none focus:border-[#D4AF37]"
            />
            <span class="text-[10px] text-[#111111]/50 mt-1 block">Tautan ke situs Anda tempat pembeli diarahkan setelah transaksi selesai.</span>
          </div>

          <div class="space-y-2 pt-1">
            <div class="flex items-center justify-between p-3 rounded-lg bg-[#111111]/[0.02] border border-[#111111]/10">
              <div>
                <div class="text-xs font-bold text-[#111111]">Pemulihan Keranjang (Cart Recovery)</div>
                <div class="text-[10px] text-[#111111]/60">Kirim email pengingat otomatis jika pembeli membatalkan checkout QRIS/e-wallet.</div>
              </div>
              <input v-model="abandonedCartRecovery" type="checkbox" class="accent-[#0F4C3A] cursor-pointer" />
            </div>

            <div class="flex items-center justify-between p-3 rounded-lg bg-[#111111]/[0.02] border border-[#111111]/10">
              <div>
                <div class="text-xs font-bold text-[#111111]">Otomatis Undang ke Program Afiliasi</div>
                <div class="text-[10px] text-[#111111]/60">Berikan pembeli tautan referral unik untuk mempromosikan produk Anda dengan komisi.</div>
              </div>
              <input v-model="autoAffiliateRegistration" type="checkbox" class="accent-[#0F4C3A] cursor-pointer" />
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Live Preview Card -->
      <div class="lg:col-span-4">
        <AppLivePreviewCard
          :appName="newAppName"
          :appDesc="newAppDesc"
          :mediaUrl="newAppMediaUrl"
          :pricingType="pricingType"
          :price="newAppPrice"
          :billingPeriodDisplay="billingPeriodDisplay"
          :hasTrialPeriod="hasTrialPeriod"
          :trialPeriodDays="trialPeriodDays"
          :benefits="benefits"
          :meteringEnabled="meteringEnabled"
          :meteringAggregation="meteringAggregation"
          :meteringUnitPrice="meteringUnitPrice"
          :meteringMetricUnit="meteringMetricUnit"
          :dashboardEnv="dashboardEnv"
          :isCreating="isCreating"
          :canPublish="Boolean(newAppName && newAppSlug)"
          @publish="handleCreateProduct"
        />
      </div>
    </div>

    <!-- Usage-based Pricing Modal -->
    <AppMeteringModal
      v-model="isMeteringModalOpen"
      :initialTemplateId="meterTemplateId"
      :initialName="meterName"
      :initialEventName="meterEventName"
      :initialCalcType="meterCalcType"
      :initialUnitLabel="meterUnitLabel"
      :initialFilters="meterFilters"
      :initialUnitPrice="meteringUnitPrice"
      :initialMetricUnit="meteringMetricUnit"
      :initialFreeAllowance="meteringFreeAllowance"
      @apply="handleMeteringApply"
    />
  </div>
</template>
