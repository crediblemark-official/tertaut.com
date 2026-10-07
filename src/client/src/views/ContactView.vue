<script setup lang="ts">
import { ref } from "vue";
import PublicHeader from "../components/common/PublicHeader.vue";
import PublicFooter from "../components/common/PublicFooter.vue";
import { COMPANY_INFO } from "../constants/company";
import { useSeo } from "../composables/useSeo";
import { STATIC_PAGES_META, createJsonLd } from "../constants/seo";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Building2,
  ShieldCheck,
  Send,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-vue-next";

useSeo(STATIC_PAGES_META.contact, createJsonLd("localbusiness"));

const name = ref("");
const email = ref("");
const phone = ref("");
const subject = ref("");
const message = ref("");
const isSubmitting = ref(false);
const submitted = ref(false);

function handleSubmit() {
  if (!name.value || !email.value || !message.value) return;
  isSubmitting.value = true;
  setTimeout(() => {
    isSubmitting.value = false;
    submitted.value = true;
    name.value = "";
    email.value = "";
    phone.value = "";
    subject.value = "";
    message.value = "";
  }, 800);
}
</script>

<template>
  <div
    class="min-h-screen bg-white text-jetblack flex flex-col font-sans selection:bg-gold/20 selection:text-jetblack"
  >
    <PublicHeader />

    <main class="flex-1">
      <!-- Breadcrumb & Top Hero -->
      <section
        class="border-b border-jetblack/10 bg-gradient-to-b from-[#FCFCFC] to-[#F7F7F7] py-12 md:py-16"
      >
        <div class="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <div
            class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest/10 border border-forest/20 text-forest text-xs font-bold font-mono"
          >
            <Building2 class="w-3.5 h-3.5" />
            <span>KONTAK &amp; LEGALITAS RESMI</span>
          </div>

          <h1 class="text-3xl sm:text-4xl md:text-5xl font-black text-jetblack tracking-tight">
            Hubungi Kami
          </h1>

          <p class="max-w-2xl mx-auto text-sm sm:text-base text-jetblack/70 leading-relaxed">
            Pusat informasi resmi, bantuan pelanggan, kemitraan bisnis, dan verifikasi merchant
            untuk
            <strong>{{ COMPANY_INFO.legalName }}</strong
            >.
          </p>
        </div>
      </section>

      <!-- Main Content Grid -->
      <section class="py-12 md:py-16 max-w-6xl mx-auto px-4 sm:px-6">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <!-- Left Column: Company & Legal Contact Details -->
          <div class="lg:col-span-5 space-y-6">
            <div
              class="rounded-2xl p-6 sm:p-7 border border-jetblack/12 bg-white shadow-luxury space-y-6"
            >
              <div class="border-b border-jetblack/10 pb-4">
                <span class="text-[11px] font-bold uppercase tracking-wider text-forest font-mono"
                  >Identitas Perusahaan</span
                >
                <h2 class="text-xl font-black text-jetblack mt-1">
                  {{ COMPANY_INFO.legalName }}
                </h2>
                <p class="text-xs text-jetblack/60 mt-1">
                  {{ COMPANY_INFO.businessType }}
                </p>
              </div>

              <!-- Information List -->
              <div class="space-y-4 text-xs">
                <!-- Address -->
                <div class="flex items-start gap-3">
                  <div
                    class="w-8 h-8 rounded-lg bg-forest/10 flex items-center justify-center text-forest shrink-0 mt-0.5"
                  >
                    <MapPin class="w-4 h-4" />
                  </div>
                  <div class="space-y-0.5">
                    <div class="font-bold text-jetblack text-xs">
                      Alamat Domisili &amp; Operasional:
                    </div>
                    <div class="text-jetblack/80 leading-relaxed font-sans">
                      {{ COMPANY_INFO.address.street }}<br />
                      {{ COMPANY_INFO.address.regency }}, {{ COMPANY_INFO.address.province }}<br />
                      {{ COMPANY_INFO.address.country }}
                    </div>
                  </div>
                </div>

                <!-- Phone / WA -->
                <div class="flex items-start gap-3">
                  <div
                    class="w-8 h-8 rounded-lg bg-forest/10 flex items-center justify-center text-forest shrink-0 mt-0.5"
                  >
                    <Phone class="w-4 h-4" />
                  </div>
                  <div class="space-y-1">
                    <div class="font-bold text-jetblack text-xs">Telepon &amp; WhatsApp:</div>
                    <div class="font-mono font-bold text-sm text-jetblack">
                      {{ COMPANY_INFO.contact.phone }}
                    </div>
                    <div>
                      <a
                        :href="COMPANY_INFO.contact.whatsappUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#25D366]/10 text-[#128C7E] font-bold hover:bg-[#25D366]/20 transition"
                      >
                        <MessageCircle class="w-3.5 h-3.5" />
                        <span>Chat WhatsApp Resmi</span>
                      </a>
                    </div>
                  </div>
                </div>

                <!-- Email -->
                <div class="flex items-start gap-3">
                  <div
                    class="w-8 h-8 rounded-lg bg-forest/10 flex items-center justify-center text-forest shrink-0 mt-0.5"
                  >
                    <Mail class="w-4 h-4" />
                  </div>
                  <div class="space-y-0.5">
                    <div class="font-bold text-jetblack text-xs">Email Dukungan &amp; Bisnis:</div>
                    <a
                      :href="`mailto:${COMPANY_INFO.contact.email}`"
                      class="font-mono text-sm text-forest font-bold hover:underline block"
                    >
                      {{ COMPANY_INFO.contact.email }}
                    </a>
                  </div>
                </div>

                <!-- Operating Hours -->
                <div class="flex items-start gap-3">
                  <div
                    class="w-8 h-8 rounded-lg bg-forest/10 flex items-center justify-center text-forest shrink-0 mt-0.5"
                  >
                    <Clock class="w-4 h-4" />
                  </div>
                  <div class="space-y-0.5">
                    <div class="font-bold text-jetblack text-xs">Jam Operasional Layanan:</div>
                    <div class="text-jetblack/70">
                      {{ COMPANY_INFO.operatingHours }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Guarantee Box -->
              <div
                class="p-4 rounded-xl bg-forest/5 border border-forest/20 text-xs text-forest space-y-1.5"
              >
                <div class="font-bold flex items-center gap-1.5 text-forest">
                  <ShieldCheck class="w-4 h-4 shrink-0" />
                  <span>Jaminan Respons Cepat</span>
                </div>
                <p class="text-[11px] text-forest/80 leading-relaxed">
                  Pertanyaan terkait transaksi pembayaran, kendala aktivasi lisensi software, atau
                  verifikasi invoice akan direspons dalam waktu maksimal 1x24 jam kerja.
                </p>
              </div>
            </div>
          </div>

          <!-- Right Column: Interactive Contact Form -->
          <div class="lg:col-span-7">
            <div
              class="rounded-2xl p-6 sm:p-8 border border-jetblack/12 bg-white shadow-luxury space-y-6"
            >
              <div>
                <span class="text-[11px] font-bold uppercase tracking-wider text-forest font-mono"
                  >Kirim Pesan Langsung</span
                >
                <h3 class="text-xl font-black text-jetblack mt-1">Formulir Kontak Bantuan</h3>
                <p class="text-xs text-jetblack/65 mt-1">
                  Silakan isi rincian pertanyaan Anda di bawah ini. Tim bantuan
                  {{ COMPANY_INFO.legalName }} akan segera menghubungi Anda.
                </p>
              </div>

              <div
                v-if="submitted"
                class="p-4 rounded-xl bg-forest/10 border border-forest/30 text-forest text-xs space-y-1 animate-fadeIn"
              >
                <div class="font-bold flex items-center gap-1.5 text-sm">
                  <CheckCircle2 class="w-4 h-4 shrink-0" />
                  <span>Pesan Berhasil Terkirim!</span>
                </div>
                <p class="text-[11px] text-forest/90">
                  Terima kasih telah menghubungi kami. Kami telah menerima pesan Anda dan akan
                  merespons melalui email/WhatsApp sesegera mungkin.
                </p>
                <button
                  type="button"
                  @click="submitted = false"
                  class="mt-2 text-xs font-bold underline cursor-pointer"
                >
                  Kirim pesan lain
                </button>
              </div>

              <form v-else @submit.prevent="handleSubmit" class="space-y-4 text-xs">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <label class="font-bold text-jetblack"
                      >Nama Lengkap <span class="text-crimson">*</span></label
                    >
                    <input
                      v-model="name"
                      type="text"
                      required
                      placeholder="Contoh: Budi Santoso"
                      class="w-full px-3.5 py-2.5 rounded-xl border border-jetblack/15 bg-white text-jetblack focus:outline-none focus:border-jetblack transition text-xs"
                    />
                  </div>

                  <div class="space-y-1.5">
                    <label class="font-bold text-jetblack"
                      >Alamat Email <span class="text-crimson">*</span></label
                    >
                    <input
                      v-model="email"
                      type="email"
                      required
                      placeholder="nama@email.com"
                      class="w-full px-3.5 py-2.5 rounded-xl border border-jetblack/15 bg-white text-jetblack focus:outline-none focus:border-jetblack transition text-xs"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <label class="font-bold text-jetblack">Nomor WhatsApp / HP</label>
                    <input
                      v-model="phone"
                      type="tel"
                      placeholder="0812xxxxxxx"
                      class="w-full px-3.5 py-2.5 rounded-xl border border-jetblack/15 bg-white text-jetblack focus:outline-none focus:border-jetblack transition text-xs"
                    />
                  </div>

                  <div class="space-y-1.5">
                    <label class="font-bold text-jetblack"
                      >Topik / Keperluan <span class="text-crimson">*</span></label
                    >
                    <select
                      v-model="subject"
                      required
                      class="w-full px-3.5 py-2.5 rounded-xl border border-jetblack/15 bg-white text-jetblack focus:outline-none focus:border-jetblack transition text-xs cursor-pointer"
                    >
                      <option value="" disabled>Pilih Keperluan</option>
                      <option value="Pertanyaan Produk & Lisensi">
                        Pertanyaan Produk &amp; Lisensi
                      </option>
                      <option value="Bantuan Pembayaran / Transaksi">
                        Bantuan Pembayaran / Transaksi
                      </option>
                      <option value="Pengajuan Pengembalian Dana">
                        Pengajuan Pengembalian Dana (Refund)
                      </option>
                      <option value="Kemitraan Software Builder">
                        Kemitraan Software Builder (MoR)
                      </option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                </div>

                <div class="space-y-1.5">
                  <label class="font-bold text-jetblack"
                    >Pesan atau Kendala Anda <span class="text-crimson">*</span></label
                  >
                  <textarea
                    v-model="message"
                    required
                    rows="4"
                    placeholder="Tuliskan pertanyaan, nomor invoice transaksi, atau kebutuhan lisensi Anda secara lengkap di sini..."
                    class="w-full px-3.5 py-2.5 rounded-xl border border-jetblack/15 bg-white text-jetblack focus:outline-none focus:border-jetblack transition text-xs"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  :disabled="isSubmitting"
                  class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-jetblack text-white text-xs font-bold hover:bg-jetblack-hover transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Send class="w-3.5 h-3.5 text-gold" />
                  <span>{{ isSubmitting ? "Mengirim Pesan..." : "Kirim Pesan Sekarang" }}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>

    <PublicFooter />
  </div>
</template>
