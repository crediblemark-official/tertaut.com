<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { BookOpen, ChevronRight, X } from "lucide-vue-next";
import PublicHeader from "../components/common/PublicHeader.vue";
import PublicFooter from "../components/common/PublicFooter.vue";
import PrivacyArticles from "../components/legal/PrivacyArticles.vue";
import { COMPANY_INFO } from "../constants/company";
import { useSeo } from "../composables/useSeo";
import { STATIC_PAGES_META } from "../constants/seo";

useSeo(STATIC_PAGES_META.privacy);

const isDrawerOpen = ref(false);
const activeChapterId = ref("pasal-1");

const chapters = [
  { id: "pasal-1", num: "1", title: "Landasan Hukum & Identitas Pengendali Data" },
  { id: "pasal-2", num: "2", title: "Kategori Data Pribadi yang Dikumpulkan" },
  { id: "pasal-3", num: "3", title: "Tujuan & Dasar Pemrosesan Data Pribadi" },
  { id: "pasal-4", num: "4", title: "Cookie, Sesi & Pelacakan Sistem" },
  { id: "pasal-5", num: "5", title: "Pembagian Pihak Ketiga & Garansi Bebas Jual Data" },
  { id: "pasal-6", num: "6", title: "Standar Keamanan, Kriptografi & Isolasi Data" },
  { id: "pasal-7", num: "7", title: "Ketentuan Khusus Google Sign-In (ID & EN)" },
  { id: "pasal-8", num: "8", title: "Hak-Hak Subjek Data Pribadi (Pengguna)" },
  { id: "pasal-9", num: "9", title: "Masa Retensi & Prosedur Hapus Data" },
  { id: "pasal-10", num: "10", title: "Pembaruan Kebijakan & Saluran Kontak DPO" },
];

function scrollToChapter(id: string) {
  activeChapterId.value = id;
  const target = document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: "smooth" });
  }
}

function handleMobileChapterSelect(id: string) {
  isDrawerOpen.value = false;
  setTimeout(() => {
    scrollToChapter(id);
  }, 150);
}

let observer: IntersectionObserver | null = null;

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeChapterId.value = entry.target.id;
        }
      }
    },
    {
      rootMargin: "-100px 0px -65% 0px",
      threshold: 0,
    }
  );

  chapters.forEach((ch) => {
    const el = document.getElementById(ch.id);
    if (el) observer?.observe(el);
  });
});

onUnmounted(() => {
  observer?.disconnect();
});
</script>

<template>
  <div
    class="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans selection:bg-amber-500 selection:text-white flex flex-col relative"
  >
    <PublicHeader />

    <!-- Top Header Container -->
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 w-full pt-10 sm:pt-14 pb-8 border-b border-slate-200/80"
    >
      <div class="max-w-4xl space-y-3">
        <div
          class="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs"
        >
          <span>🔒</span>
          <span>Dokumen Resmi Hukum &amp; Pelindungan Data Pribadi</span>
        </div>

        <h1
          class="text-2xl sm:text-3xl md:text-4xl font-black text-slate-950 tracking-tight leading-tight"
        >
          Kebijakan Privasi (Privacy Policy)
        </h1>

        <div
          class="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-slate-500 font-medium"
        >
          <span>Terakhir diperbarui &amp; berlaku efektif: 7 Oktober 2026</span>
          <span>•</span>
          <span>Versi Regulasi: 1.0.0</span>
          <span>•</span>
          <span class="text-emerald-700 font-semibold"
            >Kepatuhan UU No. 27/2022 (UU PDP) &amp; Google API Policy</span
          >
        </div>
      </div>
    </div>

    <!-- Main Container: 2-Column Desktop Layout (Sidebar + Content) -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 w-full pt-8 sm:pt-10 flex-1">
      <div
        class="lg:grid lg:grid-cols-[320px_1fr] xl:grid-cols-[340px_1fr] gap-10 xl:gap-14 items-start"
      >
        <!-- DESKTOP STICKY SIDEBAR -->
        <aside class="hidden lg:block sticky top-24 self-start space-y-4">
          <div
            class="p-4.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-3.5 shadow-2xs"
          >
            <div class="flex items-center justify-between px-1">
              <h2
                class="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5"
              >
                <BookOpen class="w-3.5 h-3.5 text-forest" />
                <span>Daftar Isi Kebijakan</span>
              </h2>
              <span
                class="px-2 py-0.5 rounded-full bg-slate-200/80 text-[10px] font-bold text-slate-600"
              >
                10 Pasal
              </span>
            </div>

            <nav
              class="space-y-1 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1 text-xs sm:text-[13px] font-medium"
            >
              <button
                v-for="ch in chapters"
                :key="ch.id"
                type="button"
                @click="scrollToChapter(ch.id)"
                class="w-full text-left px-3 py-2 rounded-xl transition-all flex items-start gap-2.5 group cursor-pointer"
                :class="
                  activeChapterId === ch.id
                    ? 'bg-forest/10 text-forest-dark font-bold border border-forest/20 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                "
              >
                <span
                  class="w-5 text-[11px] font-black shrink-0 transition-colors pt-0.5"
                  :class="
                    activeChapterId === ch.id
                      ? 'text-forest'
                      : 'text-slate-400 group-hover:text-slate-600'
                  "
                >
                  {{ ch.num }}.
                </span>
                <span class="leading-snug">
                  {{ ch.title }}
                </span>
              </button>
            </nav>
          </div>

          <!-- Quick Assistance Box in Sidebar -->
          <div
            class="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 space-y-2 text-xs"
          >
            <div class="font-bold text-slate-900 flex items-center gap-1.5">
              <span>🛡️</span>
              <span>Hak Data Pribadi &amp; DPO</span>
            </div>
            <p class="text-slate-600 text-[11px] leading-relaxed">
              Untuk pertanyaan privasi, permintaan akses data, atau permohonan penghapusan akun,
              hubungi Pejabat Pelindungan Data (DPO) kami.
            </p>
            <a
              href="mailto:platformtertaut@gmail.com"
              class="inline-block font-bold text-emerald-800 hover:underline text-[11px]"
            >
              platformtertaut@gmail.com ↗
            </a>
          </div>
        </aside>

        <!-- MOBILE TRIGGER -->
        <div class="lg:hidden mb-6">
          <button
            type="button"
            @click="isDrawerOpen = true"
            class="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-900 flex items-center justify-between text-xs font-bold shadow-2xs hover:bg-slate-100 active:scale-99 transition-all cursor-pointer"
          >
            <div class="flex items-center gap-2">
              <BookOpen class="w-4 h-4 text-forest" />
              <span>Daftar Isi Kebijakan (10 Pasal)</span>
            </div>
            <div class="flex items-center gap-1 text-slate-500 font-semibold">
              <span>Buka Menu</span>
              <ChevronRight class="w-4 h-4" />
            </div>
          </button>
        </div>

        <!-- MAIN POLICY CONTENT ARTICLES -->
        <!-- MAIN POLICY CONTENT ARTICLES -->
        <PrivacyArticles />
      </div>
    </div>

    <!-- MOBILE DRAWER -->
    <div
      v-if="isDrawerOpen"
      class="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-slate-950/40 backdrop-blur-xs animate-fade-in"
      @click.self="isDrawerOpen = false"
    >
      <div
        class="bg-white rounded-t-3xl max-h-[80vh] flex flex-col p-6 shadow-2xl border-t border-slate-200 animate-slide-up"
      >
        <div class="flex items-center justify-between pb-4 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <BookOpen class="w-4 h-4 text-forest" />
            <h3 class="text-sm font-black text-slate-900">Daftar Isi Kebijakan Privasi</h3>
          </div>
          <button
            type="button"
            @click="isDrawerOpen = false"
            class="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Tutup"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <nav class="space-y-1.5 overflow-y-auto py-4 text-xs font-semibold">
          <button
            v-for="ch in chapters"
            :key="ch.id"
            type="button"
            @click="handleMobileChapterSelect(ch.id)"
            class="w-full text-left px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer"
            :class="
              activeChapterId === ch.id
                ? 'bg-forest/10 text-forest-dark font-bold border border-forest/20'
                : 'text-slate-600 hover:bg-slate-50'
            "
          >
            <div class="flex items-center gap-2.5">
              <span class="w-5 text-[11px] font-black text-slate-400">{{ ch.num }}.</span>
              <span>{{ ch.title }}</span>
            </div>
            <ChevronRight class="w-3.5 h-3.5 text-slate-400" />
          </button>
        </nav>
      </div>
    </div>

    <PublicFooter />
  </div>
</template>
