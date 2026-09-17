<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Search, Check, X, Command, Boxes, ChevronsUpDown } from 'lucide-vue-next'

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
    wrapperClass?: string
  }>(),
  {
    placeholder: 'Pilih aplikasi...',
    searchPlaceholder: 'Ketik nama software, slug, atau mode...',
    emptyMessage: 'Tidak ada aplikasi ditemukan',
    allOptionLabel: '',
    buttonClass: '',
    wrapperClass: ''
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
  <div :class="[wrapperClass || (buttonClass?.includes('w-full') ? 'w-full block' : 'inline-block')]">
    <!-- Trigger Button: Modern Enterprise App Switcher & Search Bar -->
    <button
      type="button"
      @click="openModal"
      :class="[
        'group flex items-center justify-between gap-3 text-xs bg-white hover:bg-slate-50/90 border border-slate-300/80 hover:border-slate-400 rounded-xl px-3 py-1.5 text-slate-900 shadow-2xs transition-all duration-150 cursor-pointer min-w-[170px] sm:min-w-[220px] focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500',
        buttonClass
      ]"
      title="Cari & Pilih Software (Ctrl+K)"
    >
      <div class="flex items-center gap-2 truncate">
        <!-- App Badge or Search Icon -->
        <div v-if="selectedItem" class="w-5 h-5 rounded-md bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0 shadow-2xs">
          {{ selectedItem.name.charAt(0).toUpperCase() }}
        </div>
        <Search v-else class="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 transition-colors shrink-0" />

        <!-- Title & Mode Tag -->
        <div class="flex items-center gap-1.5 truncate">
          <span v-if="selectedItem" class="text-[11px] text-slate-400 font-medium hidden sm:inline">Aplikasi:</span>
          <span class="font-bold text-xs text-slate-900 truncate">
            {{ selectedLabel }}
          </span>
          <span
            v-if="selectedItem?.mode"
            class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider shrink-0"
            :class="selectedItem.mode === 'sandbox' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'"
          >
            {{ selectedItem.mode }}
          </span>
        </div>
      </div>

      <!-- Right Action: Shortcut & Chevrons -->
      <div class="flex items-center gap-1.5 shrink-0 pl-1">
        <kbd class="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9.5px] font-mono text-slate-500 bg-slate-100 rounded border border-slate-200">
          <Command class="w-2.5 h-2.5 text-slate-400" />K
        </kbd>
        <ChevronsUpDown class="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
      </div>
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
          class="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/50 backdrop-blur-xs"
          @click.self="closeModal"
        >
          <!-- Modal Card -->
          <div
            class="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-scaleIn"
            @keydown="handleKeyDown"
          >
            <!-- Search Header Bar -->
            <div class="px-4 py-3.5 border-b border-slate-100 flex items-center gap-3 bg-white">
              <Search class="w-5 h-5 text-slate-400 shrink-0" />
              <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                :placeholder="searchPlaceholder"
                class="flex-1 text-sm bg-transparent border-none text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium"
              />
              <button
                v-if="searchQuery"
                @click="searchQuery = ''; searchInputRef?.focus()"
                class="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                title="Hapus pencarian"
              >
                <X class="w-4 h-4" />
              </button>
              <kbd class="px-2 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-100 rounded border border-slate-200 shrink-0">
                Esc
              </kbd>
            </div>

            <!-- Modal List of Software / Apps -->
            <div class="overflow-y-auto p-2 space-y-1 flex-1">
              <div class="px-3 py-1.5 text-[10.5px] font-mono font-bold uppercase text-slate-400 tracking-wider">
                Software Tersedia ({{ filteredItems.length }})
              </div>

              <!-- Optional "Semua Aplikasi" -->
              <button
                v-if="allOptionLabel && !searchQuery"
                type="button"
                @click="selectItem('')"
                class="w-full p-2.5 rounded-xl flex items-center justify-between text-left transition cursor-pointer"
                :class="[
                  !modelValue ? 'bg-amber-500/10 font-bold text-slate-900' : 'hover:bg-slate-50 text-slate-700',
                  highlightedIndex === 0 ? 'ring-2 ring-amber-500/50 bg-amber-50/50' : ''
                ]"
              >
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                    <Boxes class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="font-bold text-xs sm:text-sm text-slate-900">{{ allOptionLabel }}</div>
                    <div class="text-[11px] text-slate-500 font-normal">Tampilkan semua data tanpa filter aplikasi</div>
                  </div>
                </div>
                <Check v-if="!modelValue" class="w-4 h-4 text-amber-600" />
              </button>

              <!-- Empty Results -->
              <div
                v-if="filteredItems.length === 0"
                class="py-10 text-center text-xs text-slate-500 space-y-2"
              >
                <Search class="w-6 h-6 mx-auto text-slate-300" />
                <p class="font-bold text-slate-700">{{ emptyMessage }}</p>
                <p class="text-xs text-slate-400">Coba gunakan kata kunci nama atau slug software yang lain.</p>
              </div>

              <!-- Filtered App Items -->
              <button
                v-for="(item, idx) in filteredItems"
                :key="item.id"
                type="button"
                @click="selectItem(item.id)"
                class="w-full p-2.5 rounded-xl flex items-center justify-between text-left transition cursor-pointer group"
                :class="[
                  modelValue === item.id ? 'bg-amber-500/10 font-bold text-slate-900' : 'hover:bg-slate-50 text-slate-700',
                  ((allOptionLabel && !searchQuery) ? highlightedIndex === idx + 1 : highlightedIndex === idx) ? 'ring-2 ring-amber-500/50 bg-amber-50/50' : ''
                ]"
              >
                <div class="flex items-center gap-3 truncate pr-2">
                  <div class="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                    {{ item.name.charAt(0).toUpperCase() }}
                  </div>
                  <div class="truncate">
                    <div class="font-bold text-xs sm:text-sm text-slate-900 truncate">{{ item.name }}</div>
                    <div class="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                      <span v-if="item.slug">{{ item.slug }}</span>
                      <span v-if="item.mode" class="px-1.5 py-0.5 rounded font-sans uppercase font-bold text-[9px]" :class="item.mode === 'sandbox' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'">
                        {{ item.mode }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <Check v-if="modelValue === item.id" class="w-4 h-4 text-amber-600" />
                  <kbd v-else class="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100">↵</kbd>
                </div>
              </button>
            </div>

            <!-- Modal Footer Instructions -->
            <div class="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div class="flex items-center gap-2">
                <span>Gunakan <kbd class="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">↑</kbd> <kbd class="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">↓</kbd> untuk memilih</span>
                <span>•</span>
                <span><kbd class="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">Enter</kbd> konfirmasi</span>
              </div>
              <div>
                <kbd class="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">Esc</kbd> menutup
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

