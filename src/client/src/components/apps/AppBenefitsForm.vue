<script setup lang="ts">
import { ref } from "vue";
import { Plus, Check, Trash2 } from "lucide-vue-next";

const props = defineProps<{
  modelValue: string[];
}>();

const emit = defineEmits<{
  "update:modelValue": [val: string[]];
}>();

const newBenefitInput = ref("");

const suggestedBenefits = [
  "Unduhan berkas digital instan",
  "Update seumur hidup & patch",
  "Akses channel komunitas privat",
  "Lisensi komersial software",
  "Dukungan teknis prioritas",
  "Kunci API & kredensial instan",
];

function addBenefit() {
  const text = newBenefitInput.value.trim();
  if (!text) return;
  if (!props.modelValue.includes(text)) {
    emit("update:modelValue", [...props.modelValue, text]);
  }
  newBenefitInput.value = "";
}

function addSuggestedBenefit(sug: string) {
  const text = sug.trim();
  if (!props.modelValue.includes(text)) {
    emit("update:modelValue", [...props.modelValue, text]);
  }
}

function updateBenefit(index: number, val: string) {
  const updated = [...props.modelValue];
  updated[index] = val;
  emit("update:modelValue", updated);
}

function removeBenefit(index: number) {
  const updated = [...props.modelValue];
  updated.splice(index, 1);
  emit("update:modelValue", updated);
}
</script>

<template>
  <div class="space-y-3.5">
    <div class="flex items-center justify-between">
      <h2 class="text-xs font-bold text-jetblack">Manfaat Produk</h2>
      <span class="text-[11px] font-bold text-jetblack/55 font-mono tracking-wider">
        {{ modelValue.length }} poin
      </span>
    </div>

    <div class="flex items-center gap-2">
      <input
        v-model="newBenefitInput"
        type="text"
        @keydown.enter.prevent="addBenefit"
        placeholder="Contoh: Update seumur hidup, Dukungan 24/7"
        class="flex-1 px-3 py-2 text-xs bg-white border border-jetblack/15 rounded-lg text-jetblack placeholder:text-jetblack/35 focus:outline-none focus:border-gold"
      />
      <button
        type="button"
        @click="addBenefit"
        :disabled="!newBenefitInput.trim()"
        class="px-3.5 py-2 rounded-lg bg-jetblack hover:bg-jetblack-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 cursor-pointer flex items-center gap-1.5 shrink-0"
      >
        <Plus class="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Tambah</span>
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-1.5">
      <button
        v-for="sug in suggestedBenefits"
        :key="sug"
        type="button"
        @click="addSuggestedBenefit(sug)"
        :disabled="modelValue.includes(sug)"
        class="text-[10.5px] px-2 py-0.5 rounded bg-jetblack/5 hover:bg-jetblack/10 text-jetblack font-medium transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
      >
        <Plus class="w-2.5 h-2.5" />
        <span>{{ sug }}</span>
      </button>
    </div>

    <!-- Hairline Benefits List (No Per-Item Floating Boxes) -->
    <div
      v-if="modelValue.length > 0"
      class="divide-y divide-jetblack/10 border-y border-jetblack/10"
    >
      <div
        v-for="(b, idx) in modelValue"
        :key="idx"
        class="flex items-center justify-between gap-2 py-2"
      >
        <div class="flex items-center gap-2.5 flex-1 min-w-0">
          <Check class="w-3.5 h-3.5 text-forest shrink-0 stroke-[2.5]" />
          <input
            :value="b"
            @input="updateBenefit(idx, ($event.target as HTMLInputElement).value)"
            type="text"
            class="w-full text-xs font-medium text-jetblack bg-transparent focus:outline-none focus:bg-jetblack/[0.025] px-1.5 py-0.5 rounded"
          />
        </div>
        <button
          type="button"
          @click="removeBenefit(idx)"
          aria-label="Hapus"
          title="Hapus"
          class="p-1.5 rounded text-jetblack/35 hover:text-rose-600 transition cursor-pointer shrink-0"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <p v-else class="text-xs text-jetblack/50 py-2 border-t border-jetblack/10">
      Belum ada poin manfaat ditambahkan.
    </p>
  </div>
</template>
