<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Search, ChevronDown, Check, X } from 'lucide-vue-next'

export interface SearchPickerItem {
  id: string
  name: string
  slug?: string
  mode?: string
  subtitle?: string
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
    searchPlaceholder: 'Ketik untuk mencari...',
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
const pickerRef = ref<HTMLElement | null>(null)
const highlightedIndex = ref(-1)

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
    return matchName || matchSlug || matchSubtitle
  })
})

function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown()
  } else {
    openDropdown()
  }
}

function openDropdown() {
  isOpen.value = true
  searchQuery.value = ''
  highlightedIndex.value = -1
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}

function closeDropdown() {
  isOpen.value = false
  searchQuery.value = ''
  highlightedIndex.value = -1
}

function selectItem(id: string) {
  emit('update:modelValue', id)
  emit('change', id)
  closeDropdown()
}

function handleKeyDown(e: KeyboardEvent) {
  if (!isOpen.value) {
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault()
      openDropdown()
    }
    return
  }

  const listLength = filteredItems.value.length + (props.allOptionLabel ? 1 : 0)

  if (e.key === 'Escape') {
    e.preventDefault()
    closeDropdown()
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
      highlightedIndex.value = listLength - 1
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (props.allOptionLabel && highlightedIndex.value === 0) {
      selectItem('')
      return
    }

    const itemIndex = props.allOptionLabel ? highlightedIndex.value - 1 : highlightedIndex.value
    if (itemIndex >= 0 && itemIndex < filteredItems.value.length) {
      selectItem(filteredItems.value[itemIndex].id)
    } else if (filteredItems.value.length === 1) {
      selectItem(filteredItems.value[0].id)
    }
  }
}

function handleClickOutside(e: MouseEvent) {
  if (pickerRef.value && !pickerRef.value.contains(e.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

watch(() => props.modelValue, () => {
  // Update highlighted index if needed
})
</script>

<template>
  <div ref="pickerRef" class="relative inline-block text-left" @keydown="handleKeyDown">
    <!-- Trigger Button -->
    <button
      type="button"
      @click="toggleDropdown"
      :class="[
        'flex items-center justify-between gap-2 text-xs font-bold bg-white border border-[#111111]/15 rounded-lg px-2.5 py-1.5 text-[#111111] hover:border-[#D4AF37] focus:outline-none focus:border-[#D4AF37] transition cursor-pointer shadow-2xs min-w-[140px]',
        isOpen ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/30' : '',
        buttonClass
      ]"
      :aria-expanded="isOpen"
    >
      <span class="truncate max-w-[160px] sm:max-w-[200px]">
        {{ selectedLabel }}
      </span>
      <ChevronDown
        class="w-3.5 h-3.5 text-[#111111]/40 shrink-0 transition-transform duration-200"
        :class="isOpen ? 'rotate-180 text-[#D4AF37]' : ''"
      />
    </button>

    <!-- Popover Search & Pick Menu -->
    <div
      v-if="isOpen"
      class="absolute right-0 sm:right-auto sm:left-0 z-50 mt-1.5 w-64 sm:w-72 bg-white rounded-xl border border-[#111111]/15 shadow-xl py-1.5 overflow-hidden animate-fadeIn"
    >
      <!-- Search Input Header -->
      <div class="px-2.5 pb-2 pt-1 border-b border-[#111111]/10">
        <div class="relative flex items-center">
          <Search class="w-3.5 h-3.5 absolute left-2.5 text-[#111111]/40 pointer-events-none" />
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            :placeholder="searchPlaceholder"
            class="w-full pl-8 pr-7 py-1.5 text-xs bg-[#FAFAFA] border border-[#111111]/10 rounded-lg text-[#111111] placeholder:text-[#111111]/35 focus:outline-none focus:bg-white focus:border-[#D4AF37] transition"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''; searchInputRef?.focus()"
            class="absolute right-2 text-[#111111]/30 hover:text-[#111111] cursor-pointer"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Item List Options -->
      <div class="max-h-56 overflow-y-auto p-1 space-y-0.5 text-xs">
        <!-- Optional "Semua Aplikasi" -->
        <button
          v-if="allOptionLabel && !searchQuery"
          type="button"
          @click="selectItem('')"
          class="w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-left transition cursor-pointer"
          :class="[
            !modelValue ? 'bg-[#D4AF37]/15 font-bold text-[#111111]' : 'hover:bg-[#111111]/5 text-[#111111]/80',
            highlightedIndex === 0 ? 'ring-1 ring-[#D4AF37]' : ''
          ]"
        >
          <span>{{ allOptionLabel }}</span>
          <Check v-if="!modelValue" class="w-3.5 h-3.5 text-[#D4AF37]" />
        </button>

        <!-- Empty State -->
        <div
          v-if="filteredItems.length === 0"
          class="py-4 text-center text-xs text-[#111111]/50 space-y-1"
        >
          <Search class="w-4 h-4 mx-auto text-[#111111]/30" />
          <p>{{ emptyMessage }}</p>
        </div>

        <!-- Filtered App Items -->
        <button
          v-for="(item, idx) in filteredItems"
          :key="item.id"
          type="button"
          @click="selectItem(item.id)"
          class="w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-left transition cursor-pointer"
          :class="[
            modelValue === item.id ? 'bg-[#D4AF37]/15 font-bold text-[#111111]' : 'hover:bg-[#111111]/5 text-[#111111]/80',
            (allOptionLabel ? highlightedIndex === idx + 1 : highlightedIndex === idx) ? 'ring-1 ring-[#D4AF37]' : ''
          ]"
        >
          <div class="flex flex-col truncate pr-2">
            <span class="truncate">{{ item.name }}</span>
            <span v-if="item.slug || item.mode" class="text-[10px] font-mono text-[#111111]/45">
              {{ item.slug || '' }}
              <span v-if="item.mode" class="ml-1 uppercase text-[9px] font-sans px-1 rounded bg-[#111111]/5">
                {{ item.mode }}
              </span>
            </span>
          </div>

          <Check v-if="modelValue === item.id" class="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
        </button>
      </div>
    </div>
  </div>
</template>
