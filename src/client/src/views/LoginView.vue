<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { authClient } from '../lib/auth'
import {
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Zap,
  Bot,
  KeyRound,
  AlertCircle
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()

const mode = ref<'signin' | 'signup'>('signin')
const email = ref('')
const password = ref('')
const name = ref('')
const showPassword = ref(false)
const rememberMe = ref(true)
const loading = ref(false)
const error = ref('')

const isPasswordValid = computed(() => password.value.length >= 8)

function toggleMode(target: 'signin' | 'signup') {
  mode.value = target
  error.value = ''
}

function redirectAfterAuth() {
  const target = (route.query.redirect as string) || '/dashboard'
  router.replace(target.startsWith('/') ? target : '/dashboard')
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'signup') {
      if (!isPasswordValid.value) {
        throw new Error('Password harus minimal 8 karakter.')
      }
      const { error: err } = await authClient.signUp.email({
        email: email.value.trim(),
        password: password.value,
        name: name.value.trim() || email.value.split('@')[0],
      })
      if (err) throw new Error(err.message || 'Pendaftaran gagal. Silakan coba lagi.')
    } else {
      const { error: err } = await authClient.signIn.email({
        email: email.value.trim(),
        password: password.value,
      })
      if (err) throw new Error(err.message || 'Email atau password salah.')
    }
    redirectAfterAuth()
  } catch (e: any) {
    error.value = e?.message || 'Terjadi kesalahan sistem. Coba lagi.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="relative min-h-screen lg:h-screen lg:max-h-screen bg-[#090A0C] text-white flex flex-col justify-start lg:justify-center items-center p-3 sm:p-5 lg:p-6 overflow-y-auto lg:overflow-hidden selection:bg-[#D4AF37]/30 selection:text-white py-4 sm:py-6">
    <!-- Ambient Lighting & Developer Grid Background -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div class="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[450px] bg-gradient-to-tr from-[#0F4C3A]/20 via-[#D4AF37]/10 to-transparent rounded-full blur-[140px]"></div>
    </div>

    <!-- Top Navigation Bar (Aligned with Master Card width) -->
    <div class="relative z-10 w-full max-w-4xl mb-2 sm:mb-3 flex items-center justify-between px-1 shrink-0">
      <router-link
        to="/"
        class="inline-flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white transition group"
      >
        <ArrowLeft class="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition" />
        <span>Kembali ke Beranda</span>
      </router-link>

      <div class="flex items-center gap-3 text-xs">
        <router-link
          to="/dashboard/docs"
          class="text-white/50 hover:text-[#D4AF37] transition"
        >
          Dokumentasi SDK
        </router-link>
        <span class="w-1 h-1 rounded-full bg-white/20"></span>
        <div class="inline-flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>v2.2 Live</span>
        </div>
      </div>
    </div>

    <!-- Master Unified Luxury Card (Anchored within Viewport, Never Pushed to Edges) -->
    <div class="relative z-10 w-full max-w-4xl h-auto lg:h-[530px] lg:max-h-[calc(100vh-5rem)] rounded-2xl border border-white/[0.12] bg-[#111215]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 shrink-0 my-auto">
      
      <!-- LEFT PANE: Engine Architecture Showcase (Fixed, Balanced & Clean) -->
      <div class="hidden lg:flex lg:col-span-6 flex-col justify-between p-6 xl:p-7 border-r border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent h-full overflow-hidden shrink-0">
        <!-- Brand Header -->
        <div class="flex items-center gap-2.5 shrink-0">
          <div class="w-7 h-7 rounded-lg bg-[#000000] border border-white/20 flex items-center justify-center font-bold text-white shadow relative">
            <span class="text-xs font-black tracking-tighter">T</span>
            <span class="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37]"></span>
          </div>
          <div>
            <div class="font-extrabold text-sm tracking-tight text-white flex items-center gap-0.5 font-mono leading-tight">
              tertaut<span class="text-[#D4AF37]">.com</span>
            </div>
            <div class="text-[9px] text-white/40 font-mono tracking-wider uppercase leading-tight">Developer Infrastructure Engine</div>
          </div>
        </div>

        <!-- Middle Value & Code -->
        <div class="space-y-3.5 my-auto py-1">
          <div class="space-y-1">
            <h2 class="text-lg xl:text-xl font-bold tracking-tight text-white leading-snug">
              Infrastruktur terpadu untuk builder software &amp; AI.
            </h2>
            <p class="text-[11px] text-white/60 leading-relaxed">
              Monetisasi QRIS tanpa PT/CV, kelola lisensi mesin universal, dan amankan API Key AI Anda.
            </p>
          </div>

          <!-- Code Snippet -->
          <div class="rounded-xl border border-white/10 bg-[#0B0C0E] p-3 font-mono text-[10.5px] leading-relaxed shadow-inner">
            <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/[0.06] text-[9.5px]">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-red-500/80"></span>
                <span class="w-2 h-2 rounded-full bg-yellow-500/80"></span>
                <span class="w-2 h-2 rounded-full bg-emerald-500/80"></span>
                <span class="ml-1 text-white/40">quickstart.ts</span>
              </div>
              <span class="text-[#D4AF37]">@tertaut/sdk</span>
            </div>
            <div class="space-y-0.5 text-white/80">
              <div><span class="text-[#D4AF37]">import</span> { tertaut } <span class="text-[#D4AF37]">from</span> <span class="text-emerald-400">"@tertaut/sdk"</span>;</div>
              <div><span class="text-[#D4AF37]">const</span> auth = <span class="text-[#D4AF37]">await</span> tertaut.license.<span class="text-yellow-300">verify</span>({</div>
              <div class="pl-3">key: <span class="text-emerald-400">"TRT-PRO-9842"</span>,</div>
              <div class="pl-3">hwid: <span class="text-cyan-300">getHWID</span>()</div>
              <div>});</div>
              <div class="pt-1 flex items-center gap-1.5 text-emerald-400 text-[9.5px]">
                <CheckCircle2 class="w-3 h-3 shrink-0" />
                <span>200 OK • License Valid &amp; Proxy Active</span>
              </div>
            </div>
          </div>

          <!-- 3 Micro Features -->
          <div class="grid grid-cols-3 gap-1.5 text-[9.5px]">
            <div class="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <div class="flex items-center gap-1 text-[#D4AF37] font-semibold mb-0.5">
                <Zap class="w-3 h-3 shrink-0" />
                <span>Instant MoR</span>
              </div>
              <div class="text-white/50 text-[8.5px] leading-tight">QRIS aktif tanpa PT/CV</div>
            </div>
            <div class="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <div class="flex items-center gap-1 text-emerald-400 font-semibold mb-0.5">
                <KeyRound class="w-3 h-3 shrink-0" />
                <span>Licensing</span>
              </div>
              <div class="text-white/50 text-[8.5px] leading-tight">Node, Python, Go, dll.</div>
            </div>
            <div class="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <div class="flex items-center gap-1 text-cyan-400 font-semibold mb-0.5">
                <Bot class="w-3 h-3 shrink-0" />
                <span>AI Proxy</span>
              </div>
              <div class="text-white/50 text-[8.5px] leading-tight">Cegah kebocoran key</div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between text-[9.5px] text-white/40 pt-1.5 border-t border-white/[0.08] shrink-0">
          <div class="flex items-center gap-1.5">
            <ShieldCheck class="w-3 h-3 text-[#D4AF37]" />
            <span>256-bit Bank-Grade Encryption</span>
          </div>
          <span>&copy; {{ new Date().getFullYear() }} tertaut.com</span>
        </div>
      </div>

      <!-- RIGHT PANE: Form with Internal Container Scroll (If content expands) -->
      <div class="col-span-1 lg:col-span-6 flex flex-col h-full overflow-hidden">
        <div class="flex-1 overflow-y-auto p-5 sm:p-6 lg:p-7 custom-scrollbar flex flex-col justify-between">
          <div>
            <!-- Mobile Logo (on mobile view only) -->
            <div class="lg:hidden flex items-center justify-between mb-3.5">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-lg bg-[#000000] border border-white/20 flex items-center justify-center font-bold text-white shadow relative">
                  <span class="text-xs font-black">T</span>
                  <span class="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-[#D4AF37]"></span>
                </div>
                <span class="font-extrabold text-xs tracking-tight text-white font-mono">
                  tertaut<span class="text-[#D4AF37]">.com</span>
                </span>
              </div>
              <span class="text-[9.5px] text-emerald-400 font-mono">● v2.2 Ready</span>
            </div>

            <!-- Segmented Tab -->
            <div class="grid grid-cols-2 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08] mb-4">
              <button
                type="button"
                @click="toggleMode('signin')"
                :class="[
                  'py-1.5 text-xs font-bold rounded-md transition duration-150',
                  mode === 'signin'
                    ? 'bg-[#1E2026] text-white shadow-sm border border-white/10'
                    : 'text-white/50 hover:text-white'
                ]"
              >
                Masuk
              </button>
              <button
                type="button"
                @click="toggleMode('signup')"
                :class="[
                  'py-1.5 text-xs font-bold rounded-md transition duration-150',
                  mode === 'signup'
                    ? 'bg-[#1E2026] text-white shadow-sm border border-white/10'
                    : 'text-white/50 hover:text-white'
                ]"
              >
                Buat Akun Baru
              </button>
            </div>

            <!-- Header -->
            <div class="mb-3.5">
              <h1 class="text-lg sm:text-xl font-bold tracking-tight text-white">
                {{ mode === 'signin' ? 'Selamat datang kembali' : 'Daftar sebagai Builder' }}
              </h1>
              <p class="mt-0.5 text-xs text-white/50">
                {{ mode === 'signin'
                  ? 'Akses dashboard monetisasi, lisensi, dan analitik Anda.'
                  : 'Mulai bangun dan monetisasi software Anda dalam 30 detik.'
                }}
              </p>
            </div>

            <!-- Error Banner -->
            <div
              v-if="error"
              class="mb-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200"
            >
              <AlertCircle class="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <div class="flex-1 text-[11px] leading-snug">{{ error }}</div>
            </div>

            <!-- Form -->
            <form class="space-y-3" @submit.prevent="submit">
              <!-- Name (Signup only) -->
              <div v-if="mode === 'signup'" class="space-y-1">
                <label class="block text-[11px] font-semibold text-white/70">Nama Builder</label>
                <div class="relative">
                  <User class="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-white/40" />
                  <input
                    v-model="name"
                    type="text"
                    autocomplete="name"
                    placeholder="Nama lengkap atau alias"
                    class="auth-input w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-xs sm:text-sm text-white placeholder-white/20 outline-none transition focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30"
                  />
                </div>
              </div>

              <!-- Email -->
              <div class="space-y-1">
                <label class="block text-[11px] font-semibold text-white/70">Alamat Email</label>
                <div class="relative">
                  <Mail class="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-white/40" />
                  <input
                    v-model="email"
                    type="email"
                    required
                    autocomplete="email"
                    placeholder="nama@domain.com"
                    class="auth-input w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-xs sm:text-sm text-white placeholder-white/20 outline-none transition focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30"
                  />
                </div>
              </div>

              <!-- Password -->
              <div class="space-y-1">
                <div class="flex items-center justify-between">
                  <label class="block text-[11px] font-semibold text-white/70">Password</label>
                  <span v-if="mode === 'signup'" class="text-[10px] text-white/40 font-mono">Min. 8 karakter</span>
                </div>
                <div class="relative">
                  <Lock class="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-white/40" />
                  <input
                    v-model="password"
                    :type="showPassword ? 'text' : 'password'"
                    required
                    minlength="8"
                    :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
                    placeholder="••••••••••••"
                    class="auth-input w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-9 pr-9 text-xs sm:text-sm text-white placeholder-white/20 outline-none transition focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30"
                  />
                  <button
                    type="button"
                    class="absolute right-2.5 top-2 p-0.5 rounded text-white/40 hover:text-white transition"
                    @click="showPassword = !showPassword"
                    :title="showPassword ? 'Sembunyikan password' : 'Lihat password'"
                  >
                    <EyeOff v-if="showPassword" class="h-3.5 w-3.5" />
                    <Eye v-else class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <!-- Remember / Forgot -->
              <div v-if="mode === 'signin'" class="flex items-center justify-between pt-0.5 text-[11px]">
                <label class="flex items-center gap-1.5 cursor-pointer select-none text-white/60">
                  <input
                    v-model="rememberMe"
                    type="checkbox"
                    class="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-[#D4AF37] focus:ring-0"
                  />
                  <span>Ingat sesi saya</span>
                </label>
                <a
                  href="#"
                  @click.prevent="error = 'Hubungi administrator atau gunakan email builder Anda.'"
                  class="text-[#D4AF37] hover:underline"
                >
                  Lupa password?
                </a>
              </div>

              <!-- Password Requirement Pill for Signup -->
              <div v-if="mode === 'signup' && password.length > 0" class="pt-0.5 flex items-center gap-2">
                <div class="h-1 flex-1 rounded-full overflow-hidden bg-white/10">
                  <div
                    class="h-full transition-all duration-200"
                    :class="password.length >= 8 ? 'bg-emerald-400 w-full' : 'bg-[#D4AF37] w-1/2'"
                  ></div>
                </div>
                <span
                  class="text-[10px] font-mono"
                  :class="password.length >= 8 ? 'text-emerald-400' : 'text-[#D4AF37]'"
                >
                  {{ password.length >= 8 ? '✓ Memenuhi syarat' : 'Min. 8 karakter' }}
                </span>
              </div>

              <!-- Submit Button -->
              <div class="pt-1">
                <button
                  type="submit"
                  :disabled="loading || (mode === 'signup' && !isPasswordValid)"
                  class="w-full flex items-center justify-center gap-2 rounded-lg bg-[#D4AF37] hover:bg-[#c5a030] active:scale-[0.99] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#111111] shadow-sm transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
                  <span>{{ mode === 'signin' ? 'Masuk ke Dashboard' : 'Daftar Akun Builder' }}</span>
                  <ArrowRight v-if="!loading" class="w-3.5 h-3.5 ml-0.5" />
                </button>
              </div>
            </form>
          </div>

          <!-- Bottom Footer Area inside scroll container -->
          <div class="mt-3 shrink-0">
            <div class="pt-2 border-t border-white/[0.06] text-center text-[11px] text-white/50">
              {{ mode === 'signin' ? 'Belum memiliki akun builder?' : 'Sudah terdaftar sebelumnya?' }}
              <button
                type="button"
                class="ml-1 font-semibold text-[#D4AF37] hover:underline"
                @click="toggleMode(mode === 'signin' ? 'signup' : 'signin')"
              >
                {{ mode === 'signin' ? 'Daftar sekarang' : 'Masuk di sini' }}
              </button>
            </div>

            <div class="text-center text-[9.5px] text-white/30 pt-2">
              Dengan melanjutkan, Anda menyetujui Ketentuan Layanan &amp; Kebijakan Privasi tertaut.com.
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Internal sleek scrollbar for container */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 9999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(212, 175, 55, 0.4);
}

/* Dark mode seamless autofill styling */
.auth-input:-webkit-autofill,
.auth-input:-webkit-autofill:hover,
.auth-input:-webkit-autofill:focus,
.auth-input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 30px #141519 inset !important;
  -webkit-text-fill-color: #ffffff !important;
  caret-color: #ffffff !important;
  transition: background-color 5000s ease-in-out 0s;
}
</style>


