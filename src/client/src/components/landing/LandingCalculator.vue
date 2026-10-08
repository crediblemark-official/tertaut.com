<script setup lang="ts">
import { ref, computed } from "vue";
import { CheckCircle2, ArrowRight } from "lucide-vue-next";

const calcProductPrice = ref(150000);
const calcSalesCount = ref(20);

const calcGrossRevenue = computed(() => calcProductPrice.value * calcSalesCount.value);
const calcPlatformFee = computed(() => Math.round(calcGrossRevenue.value * 0.05));
const calcNetPayout = computed(() => calcGrossRevenue.value - calcPlatformFee.value);

function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}
</script>

<template>
  <section id="kalkulator" class="py-16 md:py-24 bg-[#FAFAFA] border-y border-jetblack/10">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 space-y-12">
      <div class="text-center space-y-3 max-w-2xl mx-auto">
        <h2 class="text-xs font-bold uppercase tracking-widest text-forest font-mono">
          Transparansi Finansial
        </h2>
        <h3 class="text-2xl sm:text-3xl font-extrabold text-jetblack tracking-tight">
          Kalkulator Pendapatan Bersih Anda
        </h3>
        <p class="text-xs sm:text-sm text-jetblack/65">
          Tanpa biaya setup. Tanpa biaya langganan bulanan. Anda hanya membayar flat 5% jika
          berhasil menjual.
        </p>
      </div>

      <div
        class="luxury-card rounded-2xl p-6 sm:p-10 border border-jetblack/12 shadow-luxury bg-white"
      >
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <!-- Inputs -->
          <div class="lg:col-span-7 space-y-6">
            <!-- Slider 1: Product Price -->
            <div class="space-y-2">
              <div class="flex justify-between items-center text-xs font-bold text-jetblack">
                <span>Harga Produk Anda:</span>
                <span class="font-mono text-sm text-forest font-black">{{
                  formatIDR(calcProductPrice)
                }}</span>
              </div>
              <input
                type="range"
                v-model.number="calcProductPrice"
                min="25000"
                max="1000000"
                step="25000"
                class="w-full accent-forest cursor-pointer"
              />
              <div class="flex justify-between text-[10px] text-jetblack/40 font-mono">
                <span>Rp 25.000</span>
                <span>Rp 500.000</span>
                <span>Rp 1.000.000</span>
              </div>
            </div>

            <!-- Slider 2: Estimated Sales -->
            <div class="space-y-2">
              <div class="flex justify-between items-center text-xs font-bold text-jetblack">
                <span>Estimasi Penjualan per Bulan:</span>
                <span class="font-mono text-sm text-forest font-black"
                  >{{ calcSalesCount }} Pembeli</span
                >
              </div>
              <input
                type="range"
                v-model.number="calcSalesCount"
                min="5"
                max="200"
                step="5"
                class="w-full accent-forest cursor-pointer"
              />
              <div class="flex justify-between text-[10px] text-jetblack/40 font-mono">
                <span>5 lisensi</span>
                <span>100 lisensi</span>
                <span>200 lisensi</span>
              </div>
            </div>

            <div
              class="p-4 rounded-xl bg-forest/5 border border-forest/20 text-xs text-forest space-y-1"
            >
              <div class="font-bold flex items-center gap-1.5">
                <CheckCircle2 class="w-4 h-4 shrink-0" />
                <span>Termasuk Seluruh Urusan Pajak &amp; Perizinan</span>
              </div>
              <p class="text-[11px] text-forest/80 leading-relaxed">
                Tertaut menerbitkan invoice resmi dengan rincian PPN 11% dan mencatatkan bukti
                potong. Anda tidak perlu menyewa akuntan atau mendirikan PT.
              </p>
            </div>
          </div>

          <!-- Breakdown Output -->
          <div class="lg:col-span-5 p-6 rounded-2xl bg-jetblack text-white space-y-5 shadow-xl">
            <div class="text-xs font-bold text-gold uppercase tracking-wider font-mono">
              Ringkasan Pencairan
            </div>

            <div class="space-y-3 text-xs border-b border-white/10 pb-4">
              <div class="flex justify-between text-white/70">
                <span>Omzet Kotor (Gross):</span>
                <span class="font-mono text-white font-bold">{{
                  formatIDR(calcGrossRevenue)
                }}</span>
              </div>
              <div class="flex justify-between text-crimson">
                <span>Platform Fee (5%):</span>
                <span class="font-mono font-bold">-{{ formatIDR(calcPlatformFee) }}</span>
              </div>
              <div class="flex justify-between text-white/50 text-[11px]">
                <span>Biaya Bulanan Tertaut:</span>
                <span class="font-mono text-forest font-bold">Rp 0 (Gratis)</span>
              </div>
            </div>

            <div class="space-y-1">
              <div class="text-[11px] text-white/60">Uang Bersih yang Anda Terima (95%):</div>
              <div class="text-2xl sm:text-3xl font-black text-forest font-mono">
                {{ formatIDR(calcNetPayout) }}
              </div>
              <div class="text-[10px] text-white/40 pt-1">
                Langsung dicairkan ke rekening bank lokal Anda.
              </div>
            </div>

            <router-link
              to="/login"
              class="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-jetblack text-xs font-bold hover:bg-[#F2F2F2] transition active:scale-95 shadow-md"
            >
              <span>Mulai Jual Sekarang</span>
              <ArrowRight class="w-3.5 h-3.5 text-forest" />
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
