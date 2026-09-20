<script setup lang="ts">
interface AdminNavItem {
  key: string
  name: string
  icon: any
  badge?: number
  category: string
}

defineProps<{
  activeTab: string
  adminNavItems: AdminNavItem[]
}>()

const emit = defineEmits<{
  'update:activeTab': [tab: string]
}>()
</script>

<template>
  <nav class="md:hidden fixed bottom-0 left-0 right-0 min-h-[4rem] h-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-white/95 backdrop-blur-md border-t border-jetblack/10 flex items-center justify-around px-2 z-50 shadow-[0_-4px_20px_rgba(17,17,17,0.08)]">
    <button
      v-for="item in adminNavItems"
      :key="item.key"
      @click="emit('update:activeTab', item.key)"
      type="button"
      :class="[
        'flex flex-col items-center justify-center flex-1 h-14 py-1 text-[10px] font-semibold transition relative cursor-pointer active:scale-95',
        activeTab === item.key ? 'text-jetblack font-bold' : 'text-jetblack/50 hover:text-jetblack'
      ]"
    >
      <component
        :is="item.icon"
        class="w-4 h-4 mb-1 transition-transform"
        :class="activeTab === item.key ? 'text-gold scale-110' : 'text-jetblack/40'"
      />
      <!-- Badge counter if exists -->
      <span
        v-if="item.badge !== undefined && item.badge > 0"
        class="absolute top-1 right-[calc(50%-14px)] min-w-[15px] px-1 py-px rounded-full bg-gold text-jetblack text-[8px] font-black leading-tight text-center shadow-xs"
      >
        {{ item.badge }}
      </span>
      <span class="truncate max-w-[65px] text-[9.5px] leading-tight">{{ item.name.replace('Platform', '').replace('Builder', '').trim() }}</span>
      <span v-if="activeTab === item.key" class="absolute top-0.5 w-6 h-0.5 bg-gold rounded-full shadow-[0_0_4px_#D4AF37]"></span>
    </button>
  </nav>
</template>
