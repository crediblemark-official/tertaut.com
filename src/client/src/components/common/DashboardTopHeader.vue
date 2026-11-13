<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { Globe, Code2, LogOut, LogIn, Bell, X } from "lucide-vue-next";
import { dashboardEnv, envPath } from "../../lib/environment";
import { api } from "../../lib/api";

const props = defineProps<{
  currentPage: { title: string; category: string };
  authUser: { name?: string; email?: string } | null | undefined;
  authInitial: string;
  hasPayoutAccount?: boolean | null;
}>();

const emit = defineEmits<{ logout: [] }>();
const route = useRoute();
const env = dashboardEnv;

const isProfileActive = computed(
  () => route.path === "/dashboard/profile" || route.path === "/dashboard/sandbox/profile"
);

const announcement = ref<{ message: string; type: "info" | "warning" | "alert" } | null>(null);

onMounted(async () => {
  try {
    const res = await api.getPublicAnnouncement();
    if (res.success && res.hasAnnouncement && res.announcement) {
      announcement.value = res.announcement;
    }
  } catch {}
});
</script>

<template>
  <!-- Broadcast Announcement Banner (If Active) -->
  <div
    v-if="announcement"
    :class="[
      'w-full px-6 py-2 text-xs font-semibold flex items-center justify-between border-b transition no-print',
      announcement.type === 'alert'
        ? 'bg-red-50 text-red-700 border-red-200'
        : announcement.type === 'warning'
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-blue-50 text-blue-700 border-blue-200',
    ]"
  >
    <div class="flex items-center gap-2">
      <Bell class="w-3.5 h-3.5 shrink-0" />
      <span>{{ announcement.message }}</span>
    </div>
    <button
      @click="announcement = null"
      class="opacity-60 hover:opacity-100 p-0.5 cursor-pointer"
      title="Tutup"
      aria-label="Tutup"
    >
      <X class="w-3.5 h-3.5" />
    </button>
  </div>

  <!-- Desktop Top Header -->
  <header
    class="hidden md:flex items-center justify-between px-6 py-3 border-b border-jetblack/10 bg-white/90 backdrop-blur-md shrink-0 z-20"
  >
    <!-- Left: Page Title -->
    <div class="flex items-center gap-3 shrink-0">
      <h2 class="text-sm font-bold text-jetblack tracking-tight flex items-center gap-2">
        <span>{{ currentPage.title }}</span>
        <span
          class="px-2 py-0.5 rounded-full bg-jetblack/5 text-jetblack/60 text-[10px] font-mono font-normal"
          >v2.3</span
        >
      </h2>
    </div>

    <!-- Center: Page-Level Search & Filters (Teleport Target) -->
    <div
      id="dashboard-header-search"
      class="flex-1 max-w-2xl mx-4 flex items-center justify-start gap-2.5"
    ></div>

    <!-- Right: Actions & Profile -->
    <div class="flex items-center gap-3 shrink-0">
      <!-- Environment Status Pill -->
      <div
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold"
        :class="
          env === 'sandbox'
            ? 'bg-gold/15 border-gold/30 text-[#8a6d1f]'
            : 'bg-forest/10 border-forest/20 text-forest'
        "
        :title="
          env === 'sandbox'
            ? 'Environment Sandbox: pembayaran disimulasikan'
            : 'Environment Live: pembayaran diproses melalui Xendit'
        "
      >
        <span
          class="w-1.5 h-1.5 rounded-full animate-pulse"
          :class="env === 'sandbox' ? 'bg-gold' : 'bg-forest'"
        ></span>
        <span>{{ env === "sandbox" ? "Sandbox Mode" : "Live Mode" }}</span>
      </div>

      <!-- Quick Action Buttons -->
      <div class="flex items-center gap-1 border-l border-r border-jetblack/10 px-2">
        <router-link
          to="/"
          target="_blank"
          class="p-1.5 rounded-md hover:bg-jetblack/5 text-jetblack/60 hover:text-jetblack transition"
          title="Kunjungi Beranda Publik"
          ><Globe class="w-4 h-4"
        /></router-link>
        <a
          href="/swagger"
          target="_blank"
          class="p-1.5 rounded-md hover:bg-jetblack/5 text-jetblack/60 hover:text-jetblack transition"
          title="Buka Swagger API Docs"
          ><Code2 class="w-4 h-4"
        /></a>
      </div>

      <!-- Profile & Auth -->
      <div class="flex items-center gap-2 pl-1">
        <router-link
          v-if="authUser"
          :to="envPath(env, '/profile')"
          :class="[
            'flex items-center gap-2 px-2 py-1 -my-1 rounded-lg transition cursor-pointer',
            isProfileActive ? 'bg-jetblack text-white' : 'hover:bg-jetblack/[0.05] text-jetblack',
          ]"
          title="Profil Builder & Rekening Pencairan"
        >
          <div
            class="relative w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ring-2 shrink-0"
            :class="
              isProfileActive
                ? 'bg-gold text-jetblack ring-gold'
                : 'bg-jetblack text-white ring-gold/40'
            "
          >
            {{ authInitial }}
            <span
              v-if="hasPayoutAccount === false"
              class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white"
              title="Rekening pencairan belum diatur"
            ></span>
          </div>
          <div class="hidden xl:block text-left pr-0.5">
            <div
              class="text-xs font-bold leading-none"
              :class="isProfileActive ? 'text-white' : 'text-jetblack'"
            >
              {{ authUser?.name || "Builder" }}
            </div>
            <div
              class="text-[10px] font-medium mt-0.5"
              :class="isProfileActive ? 'text-white/70' : 'text-jetblack/50'"
            >
              {{ authUser?.email || "Belum login" }}
            </div>
          </div>
        </router-link>
        <div
          v-else
          class="w-7 h-7 rounded-full bg-jetblack text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-gold/40"
        >
          {{ authInitial }}
        </div>
        <button
          v-if="authUser"
          type="button"
          @click="emit('logout')"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-jetblack/15 bg-white hover:border-red-500/30 hover:bg-red-50 hover:text-red-600 text-xs font-bold text-jetblack/70 transition shadow-xs"
          title="Keluar dari akun (Log Out)"
        >
          <LogOut class="w-3.5 h-3.5 text-red-500" /><span>Keluar</span>
        </button>
        <div v-else class="flex items-center gap-1.5">
          <router-link
            to="/login"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold hover:bg-gold-muted text-xs font-bold text-jetblack transition shadow-xs"
            ><LogIn class="w-3.5 h-3.5" /><span>Masuk</span></router-link
          >
          <button
            type="button"
            class="p-1.5 rounded-md hover:bg-red-50 text-jetblack/40 hover:text-red-600 transition"
            title="Reset Sesi"
            @click="emit('logout')"
          >
            <LogOut class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
