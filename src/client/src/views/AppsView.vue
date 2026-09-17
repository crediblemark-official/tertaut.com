<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../lib/api'
import type { AppItem } from '../types/app'
import { dashboardEnv } from '../lib/environment'
import AppCatalog from '../components/apps/AppCatalog.vue'
import AppCreateForm from '../components/apps/AppCreateForm.vue'

const route = useRoute()
const router = useRouter()

const appsList = ref<AppItem[]>([])
const loading = ref(true)
const searchQuery = ref('')
const viewMode = ref<'list' | 'create'>('list')

function openCreatePage() {
  viewMode.value = 'create'
  router.push({ query: { ...route.query, action: 'new' } })
}

function closeCreatePage() {
  viewMode.value = 'list'
  const query = { ...route.query }
  delete query.action
  router.push({ query })
}

watch(() => route.query.action, (action) => {
  viewMode.value = action === 'new' ? 'create' : 'list'
}, { immediate: true })

async function loadData() {
  try {
    const appsRes = await api.getApps()
    appsList.value = appsRes.apps || []
  } catch (err) {
    console.error('Failed to load apps:', err)
  } finally {
    loading.value = false
  }
}

async function handleCreated() {
  closeCreatePage()
  await loadData()
}

onMounted(() => loadData())
watch(dashboardEnv, () => {
  loading.value = true
  loadData()
})
</script>

<template>
  <div class="animate-fadeIn pb-12">
    <AppCatalog
      v-if="viewMode === 'list'"
      :apps="appsList"
      :loading="loading"
      :search-query="searchQuery"
      @update:search-query="searchQuery = $event"
      @open-create="openCreatePage"
    />

    <AppCreateForm
      v-else
      :create-fn="api.createCampaign.bind(api)"
      @cancel="closeCreatePage"
      @created="handleCreated"
    />
  </div>
</template>
