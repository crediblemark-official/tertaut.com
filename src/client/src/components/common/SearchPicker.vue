<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Search, Check, X, Command, Boxes } from 'lucide-vue-next'

export interface SearchPickerItem {
  id: string
  name: string
  slug?: string
  mode?: string
  subtitle?: string
  targetPrice?: number
  [key: string]: any
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    items: SearchPickerItem[]
    placeholder?: string
    searchPlaceholder?: string
    emptyMessage?: string
    allOptionLabel?: string
    buttonClass?: string
  }>(),
  {
    placeholder: 'Pilih aplikasi...',
    searchPlaceholder: 'Ketik nama software, slug, atau mode...',
    emptyMessage: 'Tidak ada aplikasi ditemukan',
    allOptionLabel: '',
    buttonClass: ''
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

const isOpen = ref(false)
const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const highlightedIndex = ref(0)

const selectedItem = computed(() => {
  return props.items.find(item => item.id === props.modelValue)
})

const selectedLabel = computed(() => {
  if (!props.modelValue && props.allOptionLabel) {
    return props.allOptionLabel
  }
  return selectedItem.value?.name || props.placeholder
})

const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return props.items

  return props.items.filter(item => {
    const matchName = item.name.toLowerCase().includes(query)
    const matchSlug = item.slug ? item.slug.toLowerCase().includes(query) : false
    const matchSubtitle = item.subtitle ? item.subtitle.toLowerCase().includes(query) : false
    const matchMode = item.mode ? item.mode.toLowerCase().includes(query) : false
    return matchName || matchSlug || matchSubtitle || matchMode
  })
})

function openModal() {
  isOpen.value = true
  searchQuery.value = ''
  highlightedIndex.value = 0
  document.body.style.overflow = 'hidden'
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}

function closeModal() {
  isOpen.value = false
  searchQuery.value = ''
  highlightedIndex.value = 0
  document.body.style.overflow = ''
}

function selectItem(id: string) {
  emit('update:modelValue', id)
  emit('change', id)
  closeModal()
}

function handleKeyDown(e: KeyboardEvent) {
  if (!isOpen.value) {
    // Open on Ctrl+K or Cmd+K
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      openModal()
    }
    return
  }

  const listLength = filteredItems.value.length + (props.allOptionLabel ? 1 : 0)

  if (e.key === 'Escape') {
    e.preventDefault()
    closeModal()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (highlightedIndex.value < listLength - 1) {
      highlightedIndex.value++
    } else {
      highlightedIndex.value = 0
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (highlightedIndex.value > 0) {
      highlightedIndex.value--
    } else {
      highlightedIndex.value = Math.max(0, listLength - 1)
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (props.allOptionLabel && highlightedIndex.value === 0 && !searchQuery.value) {
      selectItem('')
      return
    }

    const itemIndex = props.allOptionLabel && !searchQuery.value ? highlightedIndex.value - 1 : highlightedIndex.value
    if (itemIndex >= 0 && itemIndex < filteredItems.value.length) {
      selectItem(filteredItems.value[itemIndex].id)
    } else if (filteredItems.value.length === 1) {
      selectItem(filteredItems.value[0].id)
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  document.body.style.overflow = ''
})

watch(searchQuery, () => {
  highlightedIndex.value = 0
})
</script>

<template>
  <div class="inline-block">
    <!-- Trigger Button: Search & Pick Trigger -->
    <button
      type="button"
      @click="openModal"
      :class="[
        'flex items-center gap-2 text-xs font-bold bg-white border border-[#111111]/15 rounded-lg px-3 py-1.5 text-[#111111] hover:border-[#D4AF37] focus:outline-none focus:border-[#D4AF37] transition cursor-pointer shadow-2xs group',
        buttonClass
      ]"
      title="Cari & Pilih Software (Ctrl+K)"
    >
      <Search class="w-3.5 h-3.5 text-[#111111]/50 group-hover:text-[#D4AF37] transition-colors shrink-0" />
      <span class="truncate max-w-[140px] sm:max-w-[200px]">
        {{ selectedLabel }}
      </span>
      <kbd class="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-mono text-[#111111]/40 bg-[#111111]/5 rounded border border-[#111111]/10">
        <Command class="w-2.5 h-2.5" />K
      </kbd>
    </button>

    <!-- Modal Dialog: Command Palette (Search & Pick) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isOpen"
          class="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/45 backdrop-blur-xs"
          @click.self="closeModal"
        >
          <!-- Modal Card -->
          <div
            class="w-full max-w-lg bg-white rounded-2xl border border-[#111111]/15 shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-scaleIn"
            @keydown="handleKeyDown"
          >
            <!-- Search Header Bar -->
            <div class="px-4 py-3 border-b border-[#111111]/10 flex items-center gap-3 bg-white">
              <Search class="w-5 h-5 text-[#111111]/40 shrink-0" />
              <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                :placeholder="searchPlaceholder"
                class="flex-1 text-sm bg-transparent border-none text-[#111111] placeholder:text-[#111111]/35 focus:outline-none"
              />
              <button
                v-if="searchQuery"
                @click="searchQuery = ''; searchInputRef?.focus()"
                class="text-[#111111]/30 hover:text-[#111111] cursor-pointer p-1"
                title="Hapus pencarian"
              >
                <X class="w-4 h-4" />
              </button>
              <kbd class="px-2 py-0.5 text-[10px] font-mono text-[#111111]/50 bg-[#111111]/5 rounded border border-[#111111]/10 shrink-0">
                Esc
              </kbd>
            </div>

            <!-- Modal List of Software / Apps -->
            <div class="overflow-y-auto p-2 space-y-1 flex-1">
              <div class="px-3 py-1.5 text-[10px] font-mono font-bold uppercase text-[#111111]/40 tracking-wider">
                Software Tersedia ({{ filteredItems.length }})
              </div>

              <!-- Optional "Semua Aplikasi" -->
              <button
                v-if="allOptionLabel && !searchQuery"
                type="button"
                @click="selectItem('')"
                class="w-full p-2.5 rounded-xl flex items-center justify-between text-left transition cursor-pointer"
                :class="[
                  !modelValue ? 'bg-[#D4AF37]/15 font-bold text-[#111111]' : 'hover:bg-[#111111]/5 text-[#111111]/80',
                  highlightedIndex === 0 ? 'ring-1 ring-[#D4AF37]' : ''
                ]"
              >
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-[#111111]/5 flex items-center justify-center text-[#111111]/60">
                    <Boxes class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="font-bold text-xs sm:text-sm">{{ allOptionLabel }}</div>
                    <div class="text-[10px] text-[#111111]/50">Tampilkan semua data tanpa filter aplikasi</div>
                  </div>
                </div>
                <Check v-if="!modelValue" class="w-4 h-4 text-[#D4AF37]" />
              </button>

              <!-- Empty Results -->
              <div
                v-if="filteredItems.length === 0"
                class="py-10 text-center text-xs text-[#111111]/50 space-y-2"
              >
                <Search class="w-6 h-6 mx-auto text-[#111111]/25" />
                <p class="font-bold text-[#111111]/70">{{ emptyMessage }}</p>
                <p class="text-[11px] text-[#111111]/40">Coba gunakan kata kunci nama atau slug software yang lain.</p>
              </div>

              <!-- Filtered App Items -->
              <button
                v-for="(item, idx) in filteredItems"
                :key="item.id"
                type="button"
                @click="selectItem(item.id)"
                class="w-full p-2.5 rounded-xl flex items-center justify-between text-left transition cursor-pointer"
                :class="[
                  modelValue === item.id ? 'bg-[#D4AF37]/15 font-bold text-[#111111]' : 'hover:bg-[#111111]/5 text-[#111111]/80',
                  ((allOptionLabel && !searchQuery) ? highlightedIndex === idx + 1 : highlightedIndex === idx) ? 'ring-1 ring-[#D4AF37] bg-[#111111]/5' : ''
                ]"
              >
                <div class="flex items-center gap-3 truncate pr-2">
                  <div class="w-8 h-8 rounded-lg bg-[#111111] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    {{ item.name.charAt(0).toUpperCase() }}
                  </div>
                  <div class="truncate">
                    <div class="font-bold text-xs sm:text-sm text-[#111111] truncate">{{ item.name }}</div>
                    <div class="flex items-center gap-1.5 text-[10px] font-mono text-[#111111]/50">
                      <span v-if="item.slug">{{ item.slug }}</span>
                      <span v-if="item.mode" class="px-1.5 py-0.2 rounded font-sans uppercase font-bold text-[9px]" :class="item.mode === 'sandbox' ? 'bg-[#2563EB]/10 text-[#2563EB]' : 'bg-[#0F4C3A]/10 text-[#0F4C3A]'">
                        {{ item.mode }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <Check v-if="modelValue === item.id" class="w-4 h-4 text-[#D4AF37]" />
                  <kbd v-else class="text-[10px] font-mono text-[#111111]/30 opacity-0 group-hover:opacity-100">↵</kbd>
                </div>
              </button>
            </div>

            <!-- Modal Footer Instructions -->
            <div class="px-4 py-2.5 bg-[#FAFAFA] border-t border-[#111111]/10 flex items-center justify-between text-[11px] text-[#111111]/50">
              <div class="flex items-center gap-2">
                <span>Gunakan <kbd class="px-1 py-0.5 rounded bg-white border border-[#111111]/15 font-mono text-[9px]">↑</kbd> <kbd class="px-1 py-0.5 rounded bg-white border border-[#111111]/15 font-mono text-[9px]">↓</kbd> untuk memilih</span>
                <span>•</span>
                <span><kbd class="px-1 py-0.5 rounded bg-white border border-[#111111]/15 font-mono text-[9px]">Enter</kbd> konfirmasi</span>
              </div>
              <div>
                <kbd class="px-1.5 py-0.5 rounded bg-white border border-[#111111]/15 font-mono text-[9px]">Esc</kbd> menutup
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

