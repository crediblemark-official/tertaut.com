<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { authClient } from '../lib/auth'
import { KeyRound, Mail, Loader2 } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()

const mode = ref<'signin' | 'signup'>('signin')
const email = ref('')
const password = ref('')
const name = ref('')
const loading = ref(false)
const error = ref('')

function redirectAfterAuth() {
  const target = (route.query.redirect as string) || '/dashboard'
  router.replace(target.startsWith('/') ? target : '/dashboard')
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'signup') {
      const { error: err } = await authClient.signUp.email({
        email: email.value.trim(),
        password: password.value,
        name: name.value.trim() || email.value.split('@')[0],
      })
      if (err) throw new Error(err.message || 'Pendaftaran gagal')
    } else {
      const { error: err } = await authClient.signIn.email({
        email: email.value.trim(),
        password: password.value,
      })
      if (err) throw new Error(err.message || 'Email atau password salah')
    }
    redirectAfterAuth()
  } catch (e: any) {
    error.value = e?.message || 'Terjadi kesalahan. Coba lagi.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
    <div class="w-full max-w-md rounded-2xl border border-white/10 bg-[#111111] p-8 shadow-2xl">
      <div class="mb-6 text-center">
        <h1 class="text-2xl font-semibold text-white">tertaut<span class="text-[#D4AF37]">.com</span></h1>
        <p class="mt-1 text-sm text-white/50">
          {{ mode === 'signin' ? 'Masuk ke dashboard builder' : 'Buat akun builder baru' }}
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <div v-if="mode === 'signup'">
          <label class="mb-1 block text-xs font-medium text-white/60">Nama</label>
          <input
            v-model="name"
            type="text"
            autocomplete="name"
            placeholder="Nama kamu"
            class="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#D4AF37]/60"
          />
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-white/60">Email</label>
          <div class="relative">
            <Mail class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-white/30" />
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="nama@email.com"
              class="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#D4AF37]/60"
            />
          </div>
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-white/60">Password</label>
          <div class="relative">
            <KeyRound class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-white/30" />
            <input
              v-model="password"
              type="password"
              required
              minlength="8"
              autocomplete="current-password"
              placeholder="Minimal 8 karakter"
              class="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#D4AF37]/60"
            />
          </div>
        </div>

        <p v-if="error" class="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="loading"
          class="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
        >
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          {{ mode === 'signin' ? 'Masuk' : 'Daftar' }}
        </button>
      </form>

      <p class="mt-5 text-center text-xs text-white/50">
        {{ mode === 'signin' ? 'Belum punya akun?' : 'Sudah punya akun?' }}
        <button
          class="ml-1 font-medium text-[#D4AF37] hover:underline"
          @click="mode = mode === 'signin' ? 'signup' : 'signin'; error = ''"
        >
          {{ mode === 'signin' ? 'Daftar' : 'Masuk' }}
        </button>
      </p>
    </div>
  </div>
</template>
