<script setup lang="ts">
import { ref, computed } from "vue";
import { MoreHorizontal, X, LayoutDashboard } from "lucide-vue-next";

interface AdminNavItem {
  key: string;
  name: string;
  icon: any;
  badge?: number;
  category: string;
}

const props = defineProps<{
  activeTab: string;
  adminNavItems: AdminNavItem[];
}>();

const emit = defineEmits<{
  "update:activeTab": [tab: string];
}>();

const isMoreOpen = ref(false);

const PRIMARY_KEYS = ["overview", "builders", "apps", "ledger"];

const primaryItems = computed(() =>
  props.adminNavItems.filter((item) => PRIMARY_KEYS.includes(item.key))
);

const overflowGroups = computed(() => {
  const groups: { name: string; items: AdminNavItem[] }[] = [];
  for (const item of props.adminNavItems) {
    if (PRIMARY_KEYS.includes(item.key)) continue;
    let group = groups.find((g) => g.name === item.category);
    if (!group) {
      group = { name: item.category, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
});

const isMoreActive = computed(
  () =>
    !PRIMARY_KEYS.includes(props.activeTab) &&
    props.adminNavItems.some((i) => i.key === props.activeTab)
);

function shortLabel(name: string) {
  return name
    .replace("Ringkasan Platform", "Ringkasan")
    .replace("Direktori Builder", "Builder")
    .replace("Direktori Software", "Software")
    .replace("Ledger Transaksi", "Ledger")
    .replace("Platform", "")
    .trim();
}

function selectTab(key: string) {
  emit("update:activeTab", key);
  isMoreOpen.value = false;
}
</script>

<template>
  <!-- Mobile Bottom Nav (4 Primary + Lainnya, Aligned with MobileNav) -->
  <nav
    class="md:hidden fixed bottom-0 left-0 right-0 min-h-[4rem] h-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-white/95 backdrop-blur-md border-t border-jetblack/10 flex items-center px-1 z-50 shadow-[0_-4px_20px_rgba(17,17,17,0.08)]"
  >
    <div class="flex items-center w-full justify-around px-0.5">
      <button
        v-for="item in primaryItems"
        :key="item.key"
        @click="selectTab(item.key)"
        type="button"
        :class="[
          'flex flex-col items-center justify-center flex-1 h-14 py-1 text-[10px] font-semibold transition relative rounded-lg active:scale-95 cursor-pointer',
          activeTab === item.key
            ? 'text-jetblack font-bold'
            : 'text-jetblack/50 hover:text-jetblack',
        ]"
      >
        <component
          :is="item.icon"
          class="w-4 h-4 mb-1 transition-transform"
          :class="activeTab === item.key ? 'text-gold scale-110' : 'text-jetblack/40'"
        />
        <span
          v-if="item.badge !== undefined && item.badge > 0"
          class="absolute top-1 right-[calc(50%-14px)] min-w-[15px] px-1 py-px rounded-full bg-gold text-jetblack text-[8px] font-black leading-tight text-center shadow-xs"
        >
          {{ item.badge }}
        </span>
        <span class="truncate max-w-[58px] text-[9.5px] leading-tight">{{
          shortLabel(item.name)
        }}</span>
        <span
          v-if="activeTab === item.key"
          class="absolute top-0.5 w-6 h-0.5 bg-gold rounded-full shadow-[0_0_4px_#D4AF37]"
        ></span>
      </button>

      <!-- Lainnya Drawer Trigger -->
      <button
        type="button"
        @click="isMoreOpen = !isMoreOpen"
        :class="[
          'flex flex-col items-center justify-center flex-1 h-14 py-1 text-[10px] font-semibold transition relative rounded-lg active:scale-95 cursor-pointer',
          isMoreActive || isMoreOpen
            ? 'text-jetblack font-bold'
            : 'text-jetblack/50 hover:text-jetblack',
        ]"
      >
        <MoreHorizontal
          class="w-4 h-4 mb-1 transition-transform"
          :class="isMoreActive || isMoreOpen ? 'text-gold scale-110' : 'text-jetblack/40'"
        />
        <span class="truncate max-w-[58px] text-[9.5px] leading-tight">Lainnya</span>
        <span
          v-if="isMoreActive || isMoreOpen"
          class="absolute top-0.5 w-6 h-0.5 bg-gold rounded-full shadow-[0_0_4px_#D4AF37]"
        ></span>
      </button>
    </div>
  </nav>

  <!-- Mobile More Sheet (Full-Edge Hairline Grid) -->
  <div v-if="isMoreOpen" class="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
      @click="isMoreOpen = false"
    ></div>
    <div
      class="relative bg-white rounded-t-xl border-t border-jetblack/15 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-10 pb-[calc(env(safe-area-inset-bottom,0px)+72px)] animate-fadeIn max-h-[80vh] overflow-y-auto"
    >
      <div class="pt-2.5 pb-2 px-4 border-b border-jetblack/10">
        <div class="w-10 h-1 rounded-full bg-jetblack/15 mx-auto mb-2"></div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-3.5 bg-gold"></span>
            <h3 class="text-xs font-bold text-jetblack uppercase tracking-wider">Menu Admin</h3>
          </div>
          <button
            type="button"
            @click="isMoreOpen = false"
            aria-label="Tutup menu"
            class="p-1 rounded-md text-jetblack/55 hover:text-jetblack hover:bg-jetblack/5 cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div v-for="group in overflowGroups" :key="group.name">
        <div
          class="px-4 py-2 bg-jetblack/[0.02] border-b border-jetblack/10 text-[10px] font-bold text-jetblack/50 uppercase tracking-wider"
        >
          {{ group.name }}
        </div>
        <div
          class="grid grid-cols-2 divide-x divide-y divide-jetblack/10 border-b border-jetblack/10"
        >
          <button
            v-for="item in group.items"
            :key="item.key"
            type="button"
            @click="selectTab(item.key)"
            class="flex items-center gap-2.5 px-4 py-3 transition text-left cursor-pointer active:bg-jetblack/[0.04]"
            :class="
              activeTab === item.key
                ? 'bg-jetblack text-white font-bold'
                : 'bg-white text-jetblack/80'
            "
          >
            <component
              :is="item.icon"
              class="w-4 h-4 shrink-0"
              :class="activeTab === item.key ? 'text-gold' : 'text-gold'"
            />
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold leading-tight truncate">{{ item.name }}</div>
              <div
                v-if="item.badge !== undefined"
                class="text-[10px] font-mono opacity-65 truncate"
              >
                {{ item.badge }} entitas
              </div>
            </div>
          </button>
        </div>
      </div>

      <router-link
        to="/dashboard"
        @click="isMoreOpen = false"
        class="flex items-center gap-2.5 px-4 py-3 bg-jetblack/[0.02] text-jetblack font-semibold text-xs border-b border-jetblack/10"
      >
        <LayoutDashboard class="w-4 h-4 text-gold shrink-0" />
        <span>Kembali ke Builder Dashboard</span>
      </router-link>
    </div>
  </div>
</template>
