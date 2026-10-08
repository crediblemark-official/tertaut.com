<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Search,
  User,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Unlock,
} from "lucide-vue-next";
import type { PanelUserItem } from "../../types/panel";
import TableSkeleton from "../common/TableSkeleton.vue";

const props = defineProps<{
  users: PanelUserItem[];
  currentAdminEmail?: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: "updateRole", userId: string, role: string): void;
  (e: "toggleBan", userId: string): void;
}>();

const searchQuery = ref("");
const roleFilter = ref("");

const filteredUsers = computed(() => {
  return props.users.filter((u) => {
    if (roleFilter.value && u.role !== roleFilter.value) {
      return false;
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      const matchName = u.name.toLowerCase().includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      if (!matchName && !matchEmail) return false;
    }
    return true;
  });
});

const adminCount = computed(() => props.users.filter((u) => u.role === "admin").length);
const builderCount = computed(() => props.users.filter((u) => u.role !== "admin").length);
const bannedCount = computed(() => props.users.filter((u) => u.banned).length);
</script>

<template>
  <section class="space-y-4">
    <!-- Macro Summary Counter -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="p-3 rounded-xl border border-jetblack/15 bg-white space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50"
          >Total Pengguna</span
        >
        <div v-if="loading" class="h-6 w-10 bg-jetblack/10 rounded animate-pulse mt-0.5"></div>
        <div v-else class="text-lg font-black text-jetblack">{{ users.length }}</div>
      </div>
      <div class="p-3 rounded-xl border border-gold/25 bg-gold/5 space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-[#8a6d1f]"
          >Super Admin</span
        >
        <div v-if="loading" class="h-6 w-10 bg-gold/25 rounded animate-pulse mt-0.5"></div>
        <div v-else class="text-lg font-black text-[#8a6d1f]">{{ adminCount }}</div>
      </div>
      <div class="p-3 rounded-xl border border-forest/20 bg-forest/5 space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-forest"
          >Builder Terdaftar</span
        >
        <div v-if="loading" class="h-6 w-10 bg-forest/20 rounded animate-pulse mt-0.5"></div>
        <div v-else class="text-lg font-black text-forest">{{ builderCount }}</div>
      </div>
      <div class="p-3 rounded-xl border border-red-200 bg-red-50/50 space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-red-700"
          >Akun Diblokir</span
        >
        <div v-if="loading" class="h-6 w-10 bg-red-200 rounded animate-pulse mt-0.5"></div>
        <div v-else class="text-lg font-black text-red-700">{{ bannedCount }}</div>
      </div>
    </div>

    <!-- Filter & Search Bar -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-jetblack/10"
    >
      <div class="relative flex-1 max-w-sm">
        <Search class="w-3.5 h-3.5 text-jetblack/40 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari nama pengguna atau email..."
          class="w-full h-9 pl-8 pr-3 text-xs rounded-lg bg-white border border-slate-300/80 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold shadow-2xs transition"
        />
      </div>

      <div class="flex items-center gap-2">
        <select
          v-model="roleFilter"
          class="h-9 px-3 text-xs rounded-lg border border-slate-300/80 hover:border-slate-400 bg-white font-medium text-jetblack focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold shadow-2xs transition"
        >
          <option value="">Semua Role</option>
          <option value="admin">Super Admin</option>
          <option value="builder">Builder</option>
        </select>
      </div>
    </div>

    <!-- Table View -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto top-scrollbar">
      <table
        class="w-full min-w-full text-left text-xs whitespace-nowrap border-b border-jetblack/15"
      >
        <thead class="border-b border-jetblack/20 text-xs font-semibold text-jetblack/70 bg-white">
          <tr>
            <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">Pengguna</th>
            <th class="py-2.5 px-3">Role</th>
            <th class="py-2.5 px-3">Status</th>
            <th class="py-2.5 px-3">Email Verified</th>
            <th class="py-2.5 px-3">Ganti Role</th>
            <th class="py-2.5 px-3">Moderasi</th>
            <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Bergabung</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-jetblack/15">
          <TableSkeleton v-if="loading" :columns="7" :rows="5" />
          <tr v-else-if="filteredUsers.length === 0">
            <td colspan="7" class="py-8 px-3.5 sm:px-4 md:px-6 text-center text-jetblack/40">
              Tidak ada pengguna ditemukan.
            </td>
          </tr>
          <tr
            v-else
            v-for="u in filteredUsers"
            :key="u.id"
            class="hover:bg-jetblack/[0.02] transition"
          >
            <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">
              <div class="font-bold text-jetblack flex items-center gap-1.5">
                <User class="w-3.5 h-3.5 text-gold" />
                <span>{{ u.name }}</span>
              </div>
              <div class="text-[10.5px] text-jetblack/50 font-mono mt-0.5">
                {{ u.email }}
              </div>
            </td>
            <td class="py-2.5 px-3">
              <span
                v-if="u.role === 'admin'"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold/15 text-[#8a6d1f] border border-gold/30"
              >
                <Shield class="w-3 h-3 text-gold" />
                SUPER ADMIN
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-forest/10 text-forest border border-forest/20"
              >
                BUILDER
              </span>
            </td>
            <td class="py-2.5 px-3">
              <span
                v-if="u.banned"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200"
              >
                <ShieldAlert class="w-3 h-3" />
                DIBLOKIR
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200"
              >
                <ShieldCheck class="w-3 h-3" />
                AKTIF
              </span>
            </td>
            <td class="py-2.5 px-3">
              <span
                v-if="u.emailVerified"
                class="text-forest flex items-center gap-1 text-[11px] font-medium"
              >
                <CheckCircle2 class="w-3.5 h-3.5" />
                <span>Terverifikasi</span>
              </span>
              <span v-else class="text-jetblack/40 text-[11px]">Belum</span>
            </td>
            <td class="py-2.5 px-3">
              <select
                :value="u.role === 'admin' ? 'admin' : 'builder'"
                @change="emit('updateRole', u.id, ($event.target as HTMLSelectElement).value)"
                :disabled="u.email === currentAdminEmail"
                class="h-7 px-2 text-[11px] rounded border border-slate-300 bg-white font-medium text-jetblack focus:border-gold focus:outline-none disabled:opacity-50"
              >
                <option value="admin">Super Admin</option>
                <option value="builder">Builder</option>
              </select>
            </td>
            <td class="py-2.5 px-3">
              <button
                v-if="u.email !== currentAdminEmail"
                @click="emit('toggleBan', u.id)"
                :class="[
                  'px-2 py-1 rounded text-[11px] font-bold border transition cursor-pointer inline-flex items-center gap-1',
                  u.banned
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'border-red-300 bg-white text-red-600 hover:bg-red-50',
                ]"
              >
                <Unlock v-if="u.banned" class="w-3 h-3" />
                <Lock v-else class="w-3 h-3" />
                <span>{{ u.banned ? "Buka Blokir" : "Blokir" }}</span>
              </button>
              <span v-else class="text-[10px] font-bold text-jetblack/40 italic">Akun Anda</span>
            </td>
            <td
              class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right text-jetblack/50 text-[11px] font-mono"
            >
              {{ new Date(u.createdAt).toLocaleDateString("id-ID") }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
