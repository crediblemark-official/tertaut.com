<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { User, Shield, CheckCircle2, Lock, Unlock } from "lucide-vue-next";
import type { PanelUserItem } from "../../types/panel";
import TableContainer from "../common/TableContainer.vue";
import TableSkeleton from "../common/TableSkeleton.vue";
import SearchInput from "../common/SearchInput.vue";
import StatusBadge from "../common/StatusBadge.vue";
import EmptyState from "../common/EmptyState.vue";
import StatsBar from "../common/StatsBar.vue";
import StatItem from "../common/StatItem.vue";

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
const isMounted = ref(false);

onMounted(() => {
  isMounted.value = true;
});

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
    <StatsBar borderless>
      <StatItem
        label="Total Pengguna"
        :value="users.length"
        sublabel="Terdaftar di platform"
        :loading="loading"
      />
      <StatItem
        label="Super Admin"
        :value="adminCount"
        sublabel="Hak akses penuh panel"
        variant="gold"
        bordered
        :loading="loading"
      />
      <StatItem
        label="Builder Terdaftar"
        :value="builderCount"
        sublabel="Developer SaaS aktif"
        variant="forest"
        bordered
        :loading="loading"
      />
      <StatItem
        label="Akun Diblokir"
        :value="bannedCount"
        sublabel="Akses dinonaktifkan"
        variant="crimson"
        bordered
        :loading="loading"
      />
    </StatsBar>

    <!-- Global Search Input Teleported to Top Header (#admin-header-search) -->
    <Teleport v-if="isMounted" to="#admin-header-search">
      <SearchInput
        v-model="searchQuery"
        dark
        placeholder="Cari nama pengguna atau email..."
        wrapper-class="w-full max-w-md"
        input-class="h-8 text-xs"
      />
    </Teleport>

    <!-- Mobile Search Input Teleported to Admin Mobile Header (#admin-mobile-header-search) -->
    <Teleport v-if="isMounted" to="#admin-mobile-header-search">
      <SearchInput
        v-model="searchQuery"
        dark
        placeholder="Cari nama pengguna atau email..."
        wrapper-class="w-full"
        input-class="h-8 text-xs"
      />
    </Teleport>

    <!-- Unified Table Toolbar (Standard Tertaut Dark Bar) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shadow-xs mb-0 !mt-0"
    >
      <div class="flex items-center gap-2 shrink-0">
        <User class="w-3.5 h-3.5 text-gold" />
        <span class="text-xs font-bold text-white uppercase tracking-wider">
          Direktori Pengguna
        </span>
        <span
          class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold"
        >
          {{ filteredUsers.length }} pengguna
        </span>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <!-- Role Filter Pills -->
        <div
          class="flex items-center h-7 rounded-md bg-white/10 p-0.5 text-[10px] font-medium shrink-0"
        >
          <button
            type="button"
            @click="roleFilter = ''"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              roleFilter === ''
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white'
            "
          >
            Semua Role
          </button>
          <button
            type="button"
            @click="roleFilter = 'admin'"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              roleFilter === 'admin'
                ? 'bg-gold font-bold text-jetblack'
                : 'text-white/70 hover:text-white'
            "
          >
            Super Admin
          </button>
          <button
            type="button"
            @click="roleFilter = 'builder'"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              roleFilter === 'builder'
                ? 'bg-forest font-bold text-white'
                : 'text-white/70 hover:text-white'
            "
          >
            Builder
          </button>
        </div>
      </div>
    </div>

    <!-- Table View -->
    <TableContainer>
      <template #head>
        <tr>
          <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">Pengguna</th>
          <th class="py-2.5 px-3">Role</th>
          <th class="py-2.5 px-3">Status</th>
          <th class="py-2.5 px-3">Email Verified</th>
          <th class="py-2.5 px-3">Ganti Role</th>
          <th class="py-2.5 px-3">Bergabung</th>
          <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Moderasi</th>
        </tr>
      </template>

      <TableSkeleton v-if="loading" :columns="7" :rows="5" />
      <tr v-else-if="filteredUsers.length === 0">
        <td colspan="7" class="py-8 px-3.5 sm:px-4 md:px-6">
          <EmptyState
            :icon="User"
            title="Tidak ada pengguna ditemukan"
            description="Coba sesuaikan kata kunci pencarian atau filter role Anda."
            container-class="border-0 bg-transparent py-4"
          />
        </td>
      </tr>
      <tr v-else v-for="u in filteredUsers" :key="u.id" class="hover:bg-jetblack/[0.02] transition">
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
          <StatusBadge :status="u.banned ? 'DIBLOKIR' : 'AKTIF'" />
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
        <td class="py-2.5 px-3 text-jetblack/50 text-[11px] font-mono">
          {{ new Date(u.createdAt).toLocaleDateString("id-ID") }}
        </td>
        <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">
          <button
            v-if="u.email !== currentAdminEmail"
            @click="emit('toggleBan', u.id)"
            :class="[
              'px-2 py-1 rounded text-[11px] font-bold border transition cursor-pointer inline-flex items-center gap-1',
              u.banned
                ? 'border-forest/40 bg-forest/10 text-forest hover:bg-forest/20'
                : 'border-crimson/30 bg-white text-crimson hover:bg-crimson/10',
            ]"
          >
            <Unlock v-if="u.banned" class="w-3 h-3" />
            <Lock v-else class="w-3 h-3" />
            <span>{{ u.banned ? "Buka Blokir" : "Blokir" }}</span>
          </button>
          <span v-else class="text-[10px] font-bold text-jetblack/40 italic">Akun Anda</span>
        </td>
      </tr>
    </TableContainer>
  </section>
</template>
