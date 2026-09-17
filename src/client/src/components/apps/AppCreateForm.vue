<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { DeliveryConfig, MeteringConfig } from '../../types/app'
import { dashboardEnv } from '../../lib/environment'
import { formatRupiah } from '../../lib/utils'
import {
  Plus,
  X,
  ArrowLeft,
  RefreshCw,
  Key,
  FileText,
  Lock,
  Sparkles,
  Zap,
  Cpu,
  Database,
  Users,
  Edit3,
  Trash2,
  Check,
  ChevronDown,
  Image as ImageIcon,
} from 'lucide-vue-next'

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
const productStatus = ref<'active' | 'draft'>('active')

const newAppName = ref('')
const newAppSlug = ref('')
const slugManuallyEdited = ref(false)
const newAppDesc = ref('')
const newAppMediaUrl = ref('')

const pricingType = ref<'one_time' | 'subscription' | 'free'>('subscription')
const newAppPrice = ref(49000)
const billingPeriod = ref<'monthly' | 'yearly'>('monthly')

const hasLicenseKey = ref(true)
const licenseDescription = ref('Lisensi Software Pro')
const licenseHasExpiry = ref(true)
const licenseExpiryValue = ref(30)
const licenseExpiryUnit = ref<'days' | 'months' | 'years'>('days')
const licenseLimitSeats = ref(true)
const licenseMaxSeats = ref(3)

const hasFileDownload = ref(false)
const fileTitle = ref('Premium Starter Kit')
const fileUrl = ref('')

const hasPrivateNote = ref(false)
const noteTitle = ref('Instruksi Akses & Akun')
const noteContent = ref('')

const isDeliveryDropdownOpen = ref(false)
const returnUrl = ref('')
const abandonedCartRecovery = ref(false)
const autoAffiliateRegistration = ref(false)

// Metering
const meteringEnabled = ref(false)
const isMeteringModalOpen = ref(false)
const selectedMeteringTemplate = ref<'llm_tokens' | 'api_calls' | 'compute_minutes' | 'storage' | 'active_seats' | 'custom'>('llm_tokens')
const meteringUnitPrice = ref(15)
const meteringMetricUnit = ref('per 1.000 token')

const meteringTemplates = [
  { id: 'llm_tokens' as const, name: 'Token LLM', icon: Sparkles, description: 'Tagih untuk konsumsi model AI', aggregation: 'sum(tokens) on ai_usage', defaultUnit: 'per 1.000 token', defaultPrice: 15 },
  { id: 'api_calls' as const, name: 'Permintaan API', icon: Zap, description: 'Tagih per panggilan ke API Anda', aggregation: 'count on api_call', defaultUnit: 'per panggilan', defaultPrice: 5 },
  { id: 'compute_minutes' as const, name: 'Menit komputasi', icon: Cpu, description: 'Meter pekerjaan latar belakang atau build', aggregation: 'sum(minutes) on job_completed', defaultUnit: 'per menit komputasi', defaultPrice: 50 },
  { id: 'storage' as const, name: 'Penyimpanan', icon: Database, description: 'Tagih untuk penyimpanan puncak yang disimpan', aggregation: 'max(gigabytes) on storage_snapshot', defaultUnit: 'per GB / bulan', defaultPrice: 1500 },
  { id: 'active_seats' as const, name: 'Kursi aktif', icon: Users, description: 'Tagih untuk pengguna aktif unik', aggregation: 'unique(user_id) on user_active', defaultUnit: 'per kursi aktif', defaultPrice: 25000 },
  { id: 'custom' as const, name: 'Mulai dari awal', icon: Edit3, description: 'Tentukan acara dan matematika Anda sendiri', aggregation: 'custom on your_event', defaultUnit: 'per event unit', defaultPrice: 10 },
]

const currentTemplateMeta = computed(() => meteringTemplates.find(t => t.id === selectedMeteringTemplate.value) || meteringTemplates[0])

watch(newAppName, (val) => {
  if (!slugManuallyEdited.value) {
    newAppSlug.value = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }
})

const calculatedExpiryDays = computed(() => {
  if (!licenseHasExpiry.value) return undefined
  const val = licenseExpiryValue.value || 1
  if (licenseExpiryUnit.value === 'months') return val * 30
  if (licenseExpiryUnit.value === 'years') return val * 365
  return val
})

function applyMeteringTemplate() {
  meteringEnabled.value = true
  const meta = currentTemplateMeta.value
  meteringMetricUnit.value = meta.defaultUnit
  meteringUnitPrice.value = meta.defaultPrice
  isMeteringModalOpen.value = false
}

function removeMetering() {
  meteringEnabled.value = false
}

function addDeliveryType(type: 'license' | 'file' | 'note') {
  if (type === 'license') hasLicenseKey.value = true
  if (type === 'file') hasFileDownload.value = true
  if (type === 'note') hasPrivateNote.value = true
  isDeliveryDropdownOpen.value = false
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
  hasLicenseKey.value = true
  licenseDescription.value = 'Lisensi Software Pro'
  licenseHasExpiry.value = true
  licenseExpiryValue.value = 30
  licenseExpiryUnit.value = 'days'
  licenseLimitSeats.value = true
  licenseMaxSeats.value = 3
  hasFileDownload.value = false
  fileTitle.value = 'Premium Starter Kit'
  fileUrl.value = ''
  hasPrivateNote.value = false
  noteTitle.value = 'Instruksi Akses & Akun'
  noteContent.value = ''
  meteringEnabled.value = false
  returnUrl.value = ''
  abandonedCartRecovery.value = false
  autoAffiliateRegistration.value = false
  createError.value = null
}

async function handleCreateProduct() {
  if (!newAppName.value || !newAppSlug.value) return
  isCreating.value = true
  createError.value = null

  const deliveryConfig: DeliveryConfig = {
    licenseKey: hasLicenseKey.value ? { enabled: true, description: licenseDescription.value, expiresInDays: calculatedExpiryDays.value, maxSeats: licenseLimitSeats.value ? licenseMaxSeats.value : 999 } : undefined,
    fileDownload: hasFileDownload.value ? { enabled: true, title: fileTitle.value, fileUrl: fileUrl.value, fileName: fileTitle.value } : undefined,
    privateNote: hasPrivateNote.value ? { enabled: true, title: noteTitle.value, note: noteContent.value } : undefined,
  }

  const meteringConfig: MeteringConfig | undefined = meteringEnabled.value
    ? { enabled: true, template: selectedMeteringTemplate.value, name: currentTemplateMeta.value.name, aggregation: currentTemplateMeta.value.aggregation, unitPrice: meteringUnitPrice.value, metricUnit: meteringMetricUnit.value }
    : undefined

  try {
    const data = await props.createFn({
      name: newAppName.value,
      slug: newAppSlug.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      targetPrice: pricingType.value === 'free' ? 0 : (newAppPrice.value || 0),
      pricingType: pricingType.value,
      billingPeriod: pricingType.value === 'subscription' ? billingPeriod.value : null,
      mode: dashboardEnv.value,
      description: newAppDesc.value,
      mediaUrl: newAppMediaUrl.value || null,
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
  } catch (err: any) {
    createError.value = err.message || 'Terjadi kesalahan jaringan'
  } finally {
    isCreating.value = false
  }
}

defineExpose({ resetForm })
</script>

<template>
  <div class="space-y-4">
    <!-- Header Bar -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 -mt-4 sm:-mt-5 md:-mt-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-[#111111] text-white border-b border-[#111111] flex items-center justify-between shadow-xs mb-3 sticky top-0 z-30">
      <div class="flex items-center gap-3">
        <button @click="emit('cancel')" title="Kembali ke Katalog" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer active:scale-95">
          <ArrowLeft class="w-3.5 h-3.5 stroke-[2.5]" />
          <span class="hidden sm:inline">Katalog</span>
        </button>
        <div class="flex items-center gap-2">
          <h1 class="text-xs font-bold uppercase tracking-wider text-white">Buat Produk Baru</h1>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] font-bold font-mono">Delivery &amp; Monetisasi</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex items-center bg-white/10 border border-white/15 rounded-lg px-2 py-1 text-xs">
          <span class="w-2 h-2 rounded-full mr-1.5" :class="productStatus === 'active' ? 'bg-emerald-400' : 'bg-slate-400'"></span>
          <select v-model="productStatus" class="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer">
            <option value="active" class="bg-[#111111] text-white">Aktif (Live)</option>
            <option value="draft" class="bg-[#111111] text-white">Draft (Arsip)</option>
          </select>
        </div>
        <span class="px-2 py-1 rounded-md font-bold text-[10px] hidden sm:inline-block" :class="dashboardEnv === 'sandbox' ? 'bg-[#D4AF37] text-[#111111]' : 'bg-[#0F4C3A] text-white'">
          {{ dashboardEnv === 'sandbox' ? 'Sandbox' : 'Live' }}
        </span>
        <button @click="emit('cancel')" class="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer">Batal</button>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="createError" class="p-3 rounded-xl bg-[#8B0000]/10 border border-[#8B0000]/30 text-[#8B0000] text-xs font-bold animate-fadeIn">{{ createError }}</div>

    <!-- 2-Column Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <!-- Left Column: Form Cards -->
      <div class="lg:col-span-8 space-y-4">
        <!-- 1. DETAIL PRODUK -->
        <div class="bg-white border border-[#111111]/15 rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div class="border-b border-[#111111]/10 pb-3">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-[#D4AF37]"></div>
              <h2 class="text-xs font-bold uppercase tracking-wider text-[#111111]">Detail Produk</h2>
            </div>
            <p class="text-[11px] text-[#111111]/60 mt-0.5">Nama produk, tautan publik checkout, dan deskripsi solusi.</p>
          </div>

          <!-- Media Cover -->
          <div>
            <label class="block text-[11px] font-bold text-[#111111]/70 mb-1.5">Gambar / Cover Produk</label>
            <div class="flex items-center gap-3">
              <div class="w-16 h-16 rounded-lg bg-[#111111]/5 border border-[#111111]/15 flex items-center justify-center text-[#111111]/40 overflow-hidden shrink-0">
                <img v-if="newAppMediaUrl" :src="newAppMediaUrl" class="w-full h-full object-cover" />
                <ImageIcon v-else class="w-6 h-6 stroke-[1.5]" />
              </div>
              <div class="flex-1">
                <input v-model="newAppMediaUrl" type="url" placeholder="https://images.unsplash.com/... (URL gambar cover)" class="w-full px-3 py-2 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] placeholder:text-[#111111]/35 focus:outline-none focus:border-[#D4AF37] transition shadow-2xs" />
                <span class="text-[10px] text-[#111111]/50 mt-1 block">Rekomendasi rasio 16:9 atau 1:1 format JPG/PNG.</span>
              </div>
            </div>
          </div>

          <!-- Name & Slug -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] font-bold text-[#111111]/70 mb-1">Nama Produk *</label>
              <input v-model="newAppName" type="text" placeholder="e.g. AI SEO Copilot" class="w-full px-3 py-2 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] placeholder:text-[#111111]/35 focus:outline-none focus:border-[#D4AF37] transition shadow-2xs" />
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-[11px] font-bold text-[#111111]/70">Slug Checkout URL *</label>
                <span class="text-[10px] text-[#D4AF37] font-mono font-bold">/pay/:slug</span>
              </div>
              <input v-model="newAppSlug" @input="slugManuallyEdited = true" type="text" placeholder="ai-seo-copilot" class="w-full px-3 py-2 rounded-lg bg-white border border-[#111111]/15 text-xs font-mono text-[#D4AF37] font-bold placeholder:text-[#111111]/35 focus:outline-none focus:border-[#D4AF37] transition shadow-2xs" />
            </div>
          </div>

          <!-- Description -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-[11px] font-bold text-[#111111]/70">Deskripsi Solusi</label>
              <span class="text-[10px] text-[#111111]/40 font-mono">Markdown didukung</span>
            </div>
            <textarea v-model="newAppDesc" rows="3" placeholder="Apa saja yang didapatkan pembeli? Jelaskan fitur utama dan value proposition..." class="w-full px-3 py-2 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] placeholder:text-[#111111]/35 focus:outline-none focus:border-[#D4AF37] transition shadow-2xs leading-relaxed"></textarea>
          </div>
        </div>

        <!-- 2. DELIVERY FULFILLMENT -->
        <div class="bg-white border border-[#111111]/15 rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div class="flex items-center justify-between border-b border-[#111111]/10 pb-3">
            <div>
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-[#D4AF37]"></div>
                <h2 class="text-xs font-bold uppercase tracking-wider text-[#111111]">Metode Pengiriman (Delivery)</h2>
              </div>
              <p class="text-[11px] text-[#111111]/60 mt-0.5">Kunci lisensi, berkas digital, atau catatan instruksi rahasia paska bayar.</p>
            </div>
            <div class="relative">
              <button @click="isDeliveryDropdownOpen = !isDeliveryDropdownOpen" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#111111] hover:bg-[#222222] text-xs font-bold text-white transition cursor-pointer active:scale-95 shadow-2xs">
                <Plus class="w-3.5 h-3.5 stroke-[3]" />
                <span>Tambah Item</span>
                <ChevronDown class="w-3 h-3 ml-0.5" />
              </button>
              <div v-if="isDeliveryDropdownOpen" class="absolute right-0 mt-1.5 w-52 bg-white border border-[#111111]/15 rounded-xl shadow-luxury-hover py-1 z-20 animate-fadeIn">
                <button @click="addDeliveryType('license')" :disabled="hasLicenseKey" class="w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-[#111111]/5 text-[#111111] font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                  <Key class="w-3.5 h-3.5 text-[#D4AF37]" /><span>Kunci Lisensi Software</span>
                </button>
                <button @click="addDeliveryType('file')" :disabled="hasFileDownload" class="w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-[#111111]/5 text-[#111111] font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                  <FileText class="w-3.5 h-3.5 text-blue-600" /><span>Unduhan Berkas Digital</span>
                </button>
                <button @click="addDeliveryType('note')" :disabled="hasPrivateNote" class="w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-[#111111]/5 text-[#111111] font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                  <Lock class="w-3.5 h-3.5 text-purple-600" /><span>Catatan Akses Privat</span>
                </button>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <!-- License Key Card -->
            <div v-if="hasLicenseKey" class="p-3.5 rounded-xl bg-[#111111]/[0.02] border border-[#111111]/10 space-y-3 relative">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-md bg-[#D4AF37]/15 text-[#8a6d1f] flex items-center justify-center"><Key class="w-3.5 h-3.5" /></div>
                  <span class="text-xs font-bold text-[#111111]">Kunci Lisensi (License Key Engine)</span>
                </div>
                <button @click="hasLicenseKey = false" class="text-[#111111]/40 hover:text-red-600 transition cursor-pointer"><Trash2 class="w-3.5 h-3.5" /></button>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-[#111111]/70 mb-1">Deskripsi Lisensi</label>
                <input v-model="licenseDescription" type="text" placeholder="e.g. Lisensi Software Pro" class="w-full px-3 py-1.5 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] focus:outline-none focus:border-[#D4AF37]" />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                <div class="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#111111]/10">
                  <div class="flex items-center gap-2">
                    <input type="checkbox" id="toggleExp" v-model="licenseHasExpiry" class="rounded accent-[#D4AF37] cursor-pointer" />
                    <label for="toggleExp" class="text-[11px] font-bold text-[#111111]/80 cursor-pointer">Batas Masa Aktif</label>
                  </div>
                  <div v-if="licenseHasExpiry" class="flex items-center gap-1.5">
                    <input v-model.number="licenseExpiryValue" type="number" min="1" class="w-14 px-2 py-0.5 rounded bg-slate-50 border border-[#111111]/15 text-xs text-center font-bold text-[#111111]" />
                    <select v-model="licenseExpiryUnit" class="bg-slate-50 border border-[#111111]/15 rounded px-2 py-0.5 text-[11px] font-semibold text-[#111111] cursor-pointer">
                      <option value="days">Hari</option>
                      <option value="months">Bulan</option>
                      <option value="years">Tahun</option>
                    </select>
                  </div>
                </div>
                <div class="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#111111]/10">
                  <div class="flex items-center gap-2">
                    <input type="checkbox" id="toggleSeats" v-model="licenseLimitSeats" class="rounded accent-[#D4AF37] cursor-pointer" />
                    <label for="toggleSeats" class="text-[11px] font-bold text-[#111111]/80 cursor-pointer">Batas Kursi/HWID</label>
                  </div>
                  <div v-if="licenseLimitSeats" class="flex items-center gap-1.5">
                    <input v-model.number="licenseMaxSeats" type="number" min="1" class="w-14 px-2 py-0.5 rounded bg-slate-50 border border-[#111111]/15 text-xs text-center font-bold text-[#111111]" />
                    <span class="text-[10px] text-[#111111]/60 font-semibold">kursi</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- File Download Card -->
            <div v-if="hasFileDownload" class="p-3.5 rounded-xl bg-[#111111]/[0.02] border border-[#111111]/10 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center"><FileText class="w-3.5 h-3.5" /></div>
                  <span class="text-xs font-bold text-[#111111]">Unduhan Berkas Digital (File Download)</span>
                </div>
                <button @click="hasFileDownload = false" class="text-[#111111]/40 hover:text-red-600 transition cursor-pointer"><Trash2 class="w-3.5 h-3.5" /></button>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[10px] font-bold text-[#111111]/70 mb-1">Nama Berkas / Paket</label>
                  <input v-model="fileTitle" type="text" placeholder="e.g. Starter-Kit-v2.zip" class="w-full px-3 py-1.5 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] focus:outline-none focus:border-[#D4AF37]" />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-[#111111]/70 mb-1">URL Unduhan Berkas</label>
                  <input v-model="fileUrl" type="url" placeholder="https://cdn.example.com/starter-kit.zip" class="w-full px-3 py-1.5 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] focus:outline-none focus:border-[#D4AF37]" />
                </div>
              </div>
            </div>

            <!-- Private Note Card -->
            <div v-if="hasPrivateNote" class="p-3.5 rounded-xl bg-[#111111]/[0.02] border border-[#111111]/10 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center"><Lock class="w-3.5 h-3.5" /></div>
                  <span class="text-xs font-bold text-[#111111]">Catatan Akses Privat (Private Note)</span>
                </div>
                <button @click="hasPrivateNote = false" class="text-[#111111]/40 hover:text-red-600 transition cursor-pointer"><Trash2 class="w-3.5 h-3.5" /></button>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-[#111111]/70 mb-1">Judul Instruksi</label>
                <input v-model="noteTitle" type="text" placeholder="e.g. Petunjuk Akses Repository & Token" class="w-full px-3 py-1.5 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] focus:outline-none focus:border-[#D4AF37]" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-[#111111]/70 mb-1">Isi Catatan Rahasia (Hanya tampil paska transaksi sukses)</label>
                <textarea v-model="noteContent" rows="3" placeholder="Password file zip, secret token, link invite channel Discord privat..." class="w-full px-3 py-1.5 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] focus:outline-none focus:border-[#D4AF37] leading-relaxed"></textarea>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="!hasLicenseKey && !hasFileDownload && !hasPrivateNote" class="py-8 text-center text-[#111111]/50 text-xs border border-dashed border-[#111111]/20 rounded-xl">
              Belum ada metode delivery dipilih. Klik <strong>+ Tambah Item</strong> di atas untuk menyertakan lisensi, berkas, atau catatan privat.
            </div>
          </div>
        </div>

        <!-- 3. PRICING & METERING -->
        <div class="bg-white border border-[#111111]/15 rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div class="border-b border-[#111111]/10 pb-3">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-[#D4AF37]"></div>
              <h2 class="text-xs font-bold uppercase tracking-wider text-[#111111]">Penetapan Harga &amp; Model Monetisasi</h2>
            </div>
            <p class="text-[11px] text-[#111111]/60 mt-0.5">Model bayar sekali, langganan berulang, atau tagihan berbasis penggunaan.</p>
          </div>
          <div class="grid grid-cols-3 gap-1 p-1 bg-[#111111]/5 rounded-xl border border-[#111111]/10">
            <button type="button" @click="pricingType = 'one_time'" class="py-1.5 text-xs font-bold rounded-lg transition cursor-pointer" :class="pricingType === 'one_time' ? 'bg-white text-[#111111] shadow-2xs' : 'text-[#111111]/60 hover:text-[#111111]'">Sekali Bayar</button>
            <button type="button" @click="pricingType = 'subscription'" class="py-1.5 text-xs font-bold rounded-lg transition cursor-pointer" :class="pricingType === 'subscription' ? 'bg-white text-[#111111] shadow-2xs' : 'text-[#111111]/60 hover:text-[#111111]'">Langganan</button>
            <button type="button" @click="pricingType = 'free'" class="py-1.5 text-xs font-bold rounded-lg transition cursor-pointer" :class="pricingType === 'free' ? 'bg-white text-[#111111] shadow-2xs' : 'text-[#111111]/60 hover:text-[#111111]'">Gratis</button>
          </div>
          <div v-if="pricingType !== 'free'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-[11px] font-bold text-[#111111]/70">Nominal Harga (IDR) *</label>
                <span class="text-[11px] font-mono font-bold text-[#0F4C3A]">{{ formatRupiah(newAppPrice || 0) }}</span>
              </div>
              <input v-model.number="newAppPrice" type="number" step="1000" placeholder="49000" class="w-full px-3 py-2 rounded-lg bg-white border border-[#111111]/15 text-xs font-mono font-bold text-[#111111] focus:outline-none focus:border-[#D4AF37]" />
            </div>
            <div v-if="pricingType === 'subscription'">
              <label class="block text-[11px] font-bold text-[#111111]/70 mb-1">Siklus Tagihan</label>
              <select v-model="billingPeriod" class="w-full px-3 py-2 rounded-lg bg-white border border-[#111111]/15 text-xs font-semibold text-[#111111] focus:outline-none focus:border-[#D4AF37] cursor-pointer">
                <option value="monthly">Bulanan (Monthly)</option>
                <option value="yearly">Tahunan (Yearly)</option>
              </select>
            </div>
          </div>
          <!-- Metered Billing -->
          <div class="p-3.5 rounded-xl bg-[#D4AF37]/5 border border-[#D4AF37]/25 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <div class="flex items-center gap-1.5">
                  <Sparkles class="w-3.5 h-3.5 text-[#D4AF37]" />
                  <h3 class="text-xs font-bold text-[#111111]">Biaya Berbasis Penggunaan (Metered Billing)</h3>
                </div>
                <p class="text-[11px] text-[#111111]/60">Ditagihkan di atas langganan, didebit otomatis dari saldo kredit pelanggan.</p>
              </div>
              <button v-if="!meteringEnabled" @click="isMeteringModalOpen = true" class="px-3 py-1 rounded-lg btn-gold text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95">
                <Plus class="w-3 h-3 stroke-[3]" /><span>Tambah Meter</span>
              </button>
            </div>
            <div v-if="meteringEnabled" class="p-3 rounded-xl bg-white border border-[#D4AF37]/40 flex items-center justify-between shadow-2xs">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-[#D4AF37]/15 text-[#8a6d1f] flex items-center justify-center">
                  <component :is="currentTemplateMeta.icon" class="w-4 h-4" />
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-[#111111]">{{ currentTemplateMeta.name }}</span>
                    <code class="text-[10px] text-[#8a6d1f] bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/30 font-mono font-bold">{{ currentTemplateMeta.aggregation }}</code>
                  </div>
                  <div class="text-[11px] text-[#111111]/60 font-mono mt-0.5">{{ formatRupiah(meteringUnitPrice) }} / {{ meteringMetricUnit }}</div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button @click="isMeteringModalOpen = true" class="text-xs font-bold text-[#111111]/70 hover:text-[#111111] transition cursor-pointer px-2.5 py-1 rounded-md bg-[#111111]/5 hover:bg-[#111111]/10">Ubah</button>
                <button @click="removeMetering" class="text-[#111111]/40 hover:text-red-600 transition cursor-pointer p-1"><Trash2 class="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. CHECKOUT & FOLLOW-UP -->
        <div class="bg-white border border-[#111111]/15 rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div class="border-b border-[#111111]/10 pb-3">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-[#D4AF37]"></div>
              <h2 class="text-xs font-bold uppercase tracking-wider text-[#111111]">Alur Checkout &amp; Retensi</h2>
            </div>
            <p class="text-[11px] text-[#111111]/60 mt-0.5">Tautan pengalihan paska bayar dan otomatisasi tindak lanjut calon pembeli.</p>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-[#111111]/70 mb-1">Return / Success URL (Opsional)</label>
            <input v-model="returnUrl" type="url" placeholder="https://aplikasianda.com/welcome?success=true" class="w-full px-3 py-2 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] placeholder:text-[#111111]/35 focus:outline-none focus:border-[#D4AF37]" />
            <span class="text-[10px] text-[#111111]/50 mt-1 block">Tautan ke situs Anda tempat pembeli diarahkan setelah transaksi selesai.</span>
          </div>
          <div class="space-y-2 pt-1">
            <div class="flex items-center justify-between p-3 rounded-lg bg-[#111111]/[0.02] border border-[#111111]/10">
              <div>
                <label class="text-xs font-bold text-[#111111] block">Abandoned Cart Recovery</label>
                <span class="text-[10px] text-[#111111]/60">Kirim email pengingat transaksi tertunda secara otomatis.</span>
              </div>
              <input type="checkbox" v-model="abandonedCartRecovery" class="rounded accent-[#D4AF37] cursor-pointer" />
            </div>
            <div class="flex items-center justify-between p-3 rounded-lg bg-[#111111]/[0.02] border border-[#111111]/10">
              <div>
                <label class="text-xs font-bold text-[#111111] block">Pendaftaran Afiliasi Otomatis</label>
                <span class="text-[10px] text-[#111111]/60">Secara otomatis undang pembeli menjadi mitra affiliate untuk mendapatkan komisi referral.</span>
              </div>
              <input type="checkbox" v-model="autoAffiliateRegistration" class="rounded accent-[#D4AF37] cursor-pointer" />
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Live Sticky Summary -->
      <div class="lg:col-span-4 lg:sticky lg:top-14">
        <div class="bg-white border border-[#111111]/15 rounded-xl p-5 space-y-4 shadow-sm">
          <div>
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-[#0F4C3A]"></div>
              <h2 class="text-xs font-bold uppercase tracking-wider text-[#111111]">Ringkasan Produk</h2>
            </div>
            <p class="text-[11px] text-[#111111]/60 mt-0.5">Pratinjau langsung produk sebelum diterbitkan.</p>
          </div>
          <div class="flex items-start gap-3 p-3 rounded-lg bg-[#111111]/[0.02] border border-[#111111]/10">
            <div class="w-12 h-12 rounded-md bg-[#111111]/5 border border-[#111111]/10 flex items-center justify-center overflow-hidden shrink-0">
              <img v-if="newAppMediaUrl" :src="newAppMediaUrl" class="w-full h-full object-cover" />
              <ImageIcon v-else class="w-5 h-5 text-[#111111]/40" />
            </div>
            <div class="overflow-hidden">
              <div class="text-xs font-bold text-[#111111] truncate">{{ newAppName || 'Nama Produk Belum Diset' }}</div>
              <div class="text-[10px] text-[#111111]/60 line-clamp-2 mt-0.5">{{ newAppDesc || 'Belum ada deskripsi produk.' }}</div>
            </div>
          </div>
          <div class="space-y-1.5 text-xs">
            <div class="text-[10px] uppercase font-bold text-[#111111]/50 tracking-wider">Item Delivery</div>
            <div v-if="hasLicenseKey" class="flex items-center gap-2 text-[#111111] text-[11px]"><Key class="w-3.5 h-3.5 text-[#D4AF37] shrink-0" /><span>Kunci Lisensi ({{ licenseLimitSeats ? `${licenseMaxSeats} kursi` : 'Tanpa batas' }})</span></div>
            <div v-if="hasFileDownload" class="flex items-center gap-2 text-[#111111] text-[11px]"><FileText class="w-3.5 h-3.5 text-blue-600 shrink-0" /><span>{{ fileTitle || 'Berkas Unduhan Digital' }}</span></div>
            <div v-if="hasPrivateNote" class="flex items-center gap-2 text-[#111111] text-[11px]"><Lock class="w-3.5 h-3.5 text-purple-600 shrink-0" /><span>Catatan Akses Privat</span></div>
            <div v-if="!hasLicenseKey && !hasFileDownload && !hasPrivateNote" class="text-[#111111]/40 text-[11px]">Tidak ada item delivery khusus</div>
          </div>
          <div class="space-y-1 text-xs pt-3 border-t border-[#111111]/10">
            <div class="text-[10px] uppercase font-bold text-[#111111]/50 tracking-wider">Penetapan Harga</div>
            <div class="flex items-baseline justify-between">
              <span class="text-xl font-black text-[#111111] font-mono">{{ pricingType === 'free' ? 'Gratis' : (newAppPrice ? formatRupiah(newAppPrice) : 'Rp 0') }}</span>
              <span class="text-[11px] font-semibold text-[#111111]/60">{{ pricingType === 'subscription' ? (billingPeriod === 'yearly' ? '/ Tahun' : '/ Bulan') : (pricingType === 'free' ? 'Akses Gratis' : 'Sekali Bayar') }}</span>
            </div>
            <p class="text-[10px] text-[#111111]/50">Barang digital &amp; SaaS · MoR DANA/Xendit</p>
            <div v-if="meteringEnabled" class="mt-2 pt-2 border-t border-dashed border-[#111111]/15">
              <div class="text-[10px] text-[#8a6d1f] flex items-center gap-1 font-mono font-bold"><Sparkles class="w-3 h-3 text-[#D4AF37]" /><span>+ Meter: {{ currentTemplateMeta.aggregation }}</span></div>
              <div class="text-[10px] text-[#111111]/60 font-mono">{{ formatRupiah(meteringUnitPrice) }} / {{ meteringMetricUnit }}</div>
            </div>
          </div>
          <div class="text-xs pt-3 border-t border-[#111111]/10">
            <div class="text-[10px] uppercase font-bold text-[#111111]/50 tracking-wider mb-1">Status Checkout</div>
            <div class="text-[11px] text-[#111111] font-semibold flex items-center justify-between">
              <span>Tertaut MoR Checkout</span><span class="text-[#0F4C3A] text-[10px] font-bold">Siap Aktif</span>
            </div>
          </div>
          <div class="pt-2">
            <button @click="handleCreateProduct" :disabled="isCreating || !newAppName || !newAppSlug" class="w-full py-2.5 rounded-lg btn-gold text-xs font-bold transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 active:scale-98">
              <RefreshCw v-if="isCreating" class="w-3.5 h-3.5 animate-spin" />
              <span>{{ isCreating ? 'Menerbitkan Produk...' : 'Terbitkan Produk' }}</span>
            </button>
            <p class="text-[10px] text-[#111111]/50 text-center mt-2 leading-relaxed">
              Mode {{ dashboardEnv === 'sandbox' ? 'Sandbox' : 'Live' }} — produk ini dan checkout link langsung aktif di lingkungan ini.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Metering Modal -->
    <div v-if="isMeteringModalOpen" class="fixed inset-0 bg-[#111111]/40 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div class="bg-white border border-[#111111]/15 rounded-2xl w-full max-w-xl shadow-luxury-hover p-5 space-y-4 text-[#111111]">
        <div class="flex items-center justify-between border-b border-[#111111]/10 pb-3">
          <div>
            <h3 class="text-sm font-extrabold text-[#111111]">Apa yang ingin Anda ukur?</h3>
            <p class="text-xs text-[#111111]/60">Mulai dari template metering — semuanya tetap dapat disesuaikan.</p>
          </div>
          <button @click="isMeteringModalOpen = false" class="text-[#111111]/40 hover:text-[#111111] transition cursor-pointer"><X class="w-4 h-4" /></button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div v-for="tpl in meteringTemplates" :key="tpl.id" @click="selectedMeteringTemplate = tpl.id" class="p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between" :class="selectedMeteringTemplate === tpl.id ? 'bg-[#D4AF37]/10 border-[#D4AF37] ring-1 ring-[#D4AF37] shadow-2xs' : 'bg-[#111111]/[0.02] border-[#111111]/10 hover:border-[#111111]/25'">
            <div class="flex items-start gap-2.5">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" :class="selectedMeteringTemplate === tpl.id ? 'bg-[#D4AF37] text-[#111111]' : 'bg-[#111111]/10 text-[#111111]/70'">
                <component :is="tpl.icon" class="w-4 h-4" />
              </div>
              <div class="flex-1">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-[#111111]">{{ tpl.name }}</span>
                  <div class="w-4 h-4 rounded-full border flex items-center justify-center" :class="selectedMeteringTemplate === tpl.id ? 'border-[#D4AF37] bg-[#D4AF37]' : 'border-[#111111]/20'">
                    <Check v-if="selectedMeteringTemplate === tpl.id" class="w-2.5 h-2.5 text-[#111111] stroke-[3]" />
                  </div>
                </div>
                <p class="text-[11px] text-[#111111]/60 leading-tight mt-1">{{ tpl.description }}</p>
              </div>
            </div>
            <div class="mt-2.5 pt-2 border-t border-[#111111]/10 font-mono text-[10px] text-[#8a6d1f] font-bold"><code>{{ tpl.aggregation }}</code></div>
          </div>
        </div>
        <div class="p-3.5 rounded-xl bg-[#111111]/[0.02] border border-[#111111]/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-[10px] font-bold text-[#111111]/70 mb-1">Satuan Ukuran</label>
            <input v-model="meteringMetricUnit" type="text" class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] font-medium focus:outline-none focus:border-[#D4AF37]" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-[#111111]/70 mb-1">Tarif Satuan (IDR)</label>
            <input v-model.number="meteringUnitPrice" type="number" min="1" class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] font-mono font-bold focus:outline-none focus:border-[#D4AF37]" />
          </div>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button @click="isMeteringModalOpen = false" class="px-4 py-2 rounded-lg bg-[#111111]/5 hover:bg-[#111111]/10 text-xs font-bold text-[#111111] transition cursor-pointer">Batal</button>
          <button @click="applyMeteringTemplate" class="px-5 py-2 rounded-lg btn-gold text-xs font-bold transition shadow-2xs cursor-pointer flex items-center gap-1.5 active:scale-95">
            <span>Gunakan {{ currentTemplateMeta.name }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
