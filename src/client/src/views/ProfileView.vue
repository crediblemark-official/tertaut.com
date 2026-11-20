<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { api } from "../lib/api";
import { authClient } from "../lib/auth";
import { formatDate as formatUtilsDate } from "../lib/utils";
import { useConfirm } from "../composables/useConfirm";
import CopyButton from "../components/common/CopyButton.vue";
import {
  User,
  Landmark,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  Monitor,
  ShieldCheck,
} from "lucide-vue-next";

interface SessionEntry {
  id: string;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: string | Date;
  expiresAt?: string | Date;
}

interface LinkedAccount {
  id: string;
  providerId: string;
}

const { confirm } = useConfirm();
const authSession = authClient.useSession();

const loading = ref(true);
const builder = ref<{ id: string; name: string; email: string } | null>(null);
const accounts = ref<LinkedAccount[]>([]);
const sessions = ref<SessionEntry[]>([]);

const profileName = ref("");
const isSavingProfile = ref(false);
const profileFeedback = ref<{ type: "success" | "error"; message: string } | null>(null);

const isSavingPayout = ref(false);
const payoutFeedback = ref<{ type: "success" | "error"; message: string } | null>(null);
const savedAccount = ref<{
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
} | null>(null);
const accountForm = ref({
  bankCode: "BCA",
  accountNumber: "",
  accountHolderName: "",
});

const passwordForm = ref({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
  revokeOtherSessions: true,
});
const isSavingPassword = ref(false);
const passwordFeedback = ref<{ type: "success" | "error"; message: string } | null>(null);

const isSendingVerification = ref(false);
const verificationSent = ref(false);
const revokingSessionId = ref<string | null>(null);
const isRevokingOthers = ref(false);
const sessionFeedback = ref<{ type: "success" | "error"; message: string } | null>(null);

const sessionUser = computed(() => authSession.value?.data?.user as any);
const currentSessionId = computed(() => authSession.value?.data?.session?.id || "");
const userRole = computed(() => (sessionUser.value?.role === "admin" ? "Admin" : "Builder"));
const isEmailVerified = computed(() => Boolean(sessionUser.value?.emailVerified));

const hasCredentialAccount = computed(() =>
  accounts.value.some((acc) => acc.providerId === "credential")
);

const providerLabels = computed(() => {
  if (accounts.value.length === 0) return ["Sesi Email"];
  return accounts.value.map((acc) => {
    if (acc.providerId === "credential") return "Email & Password";
    if (acc.providerId === "google") return "Google OAuth";
    return acc.providerId;
  });
});

function parseDeviceLabel(ua?: string | null): string {
  if (!ua) return "Perangkat Tidak Dikenal";
  let browser = "Browser";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/") && !ua.includes("Chromium")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";

  let os = "Desktop";
  if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Linux")) os = "Linux";

  return `${browser} · ${os}`;
}

function formatDate(dateVal?: string | Date | null): string {
  if (!dateVal) return "-";
  const str = typeof dateVal === "string" ? dateVal : dateVal.toISOString();
  return formatUtilsDate(str, { includeTime: true });
}

async function loadProfile() {
  loading.value = true;
  try {
    const [meRes, payoutRes, accountsRes, sessionsRes] = await Promise.all([
      api.getBuilderMyself().catch(() => null),
      api.getPayoutAccount().catch(() => null),
      (authClient as any).listAccounts?.().catch(() => null),
      (authClient as any).listSessions?.().catch(() => null),
    ]);

    if (meRes?.success && meRes.builder) {
      builder.value = {
        id: meRes.builder.id,
        name: meRes.builder.name,
        email: meRes.builder.email,
      };
    }

    profileName.value = sessionUser.value?.name || meRes?.builder?.name || "";

    if (payoutRes?.success && payoutRes.disbursementAccount) {
      const next = {
        bankCode: payoutRes.disbursementAccount.bankCode || "BCA",
        accountNumber: payoutRes.disbursementAccount.accountNumber || "",
        accountHolderName: payoutRes.disbursementAccount.accountHolderName || "",
      };
      accountForm.value = { ...next };
      savedAccount.value = next.accountNumber ? next : null;
    } else {
      savedAccount.value = null;
    }

    accounts.value = Array.isArray(accountsRes?.data) ? accountsRes.data : [];
    sessions.value = Array.isArray(sessionsRes?.data) ? sessionsRes.data : [];
  } finally {
    loading.value = false;
  }
}

async function handleSaveProfile() {
  profileFeedback.value = null;
  const cleanName = profileName.value.trim();
  if (!cleanName || cleanName.length > 100) {
    profileFeedback.value = {
      type: "error",
      message: "Nama tampilan wajib diisi (maksimal 100 karakter).",
    };
    return;
  }

  isSavingProfile.value = true;
  try {
    const [authRes, builderRes] = await Promise.all([
      authClient.updateUser({ name: cleanName }).catch((err: any) => ({ error: err })),
      api.updateBuilderMyself({ name: cleanName }).catch(() => null),
    ]);

    if ((authRes as any)?.error && !builderRes?.success) {
      profileFeedback.value = {
        type: "error",
        message: (authRes as any).error?.message || "Gagal memperbarui nama tampilan.",
      };
      return;
    }

    if (builder.value) {
      builder.value.name = cleanName;
    }
    await (authClient as any).getSession?.();
    profileFeedback.value = {
      type: "success",
      message: "Nama tampilan profil berhasil diperbarui.",
    };
  } catch (err: any) {
    profileFeedback.value = {
      type: "error",
      message: err?.message || "Terjadi kesalahan saat menyimpan profil.",
    };
  } finally {
    isSavingProfile.value = false;
  }
}

async function handleResendVerification() {
  const email = sessionUser.value?.email;
  if (!email) return;
  isSendingVerification.value = true;
  try {
    await (authClient as any).sendVerificationEmail?.({
      email,
      callbackURL: window.location.href,
    });
    verificationSent.value = true;
  } finally {
    isSendingVerification.value = false;
  }
}

const EWALLET_CODES = new Set(["DANA", "GOPAY", "OVO", "LINKAJA", "SHOPEEPAY"]);
const isEwalletSelected = computed(() =>
  EWALLET_CODES.has((accountForm.value.bankCode || "").toUpperCase())
);

async function handleSaveAccount() {
  payoutFeedback.value = null;
  if (!accountForm.value.accountNumber.trim() || !accountForm.value.accountHolderName.trim()) {
    payoutFeedback.value = {
      type: "error",
      message: "Nomor rekening / HP dan nama pemilik akun wajib diisi.",
    };
    return;
  }

  let cleanNumber = accountForm.value.accountNumber.trim();
  if (isEwalletSelected.value) {
    const digits = cleanNumber.replace(/[^0-9]/g, "");
    const formatted = digits.startsWith("08")
      ? `62${digits.slice(1)}`
      : digits.startsWith("8")
        ? `62${digits}`
        : digits;
    if (!/^628\d{7,12}$/.test(formatted)) {
      payoutFeedback.value = {
        type: "error",
        message: `Pencairan ke ${accountForm.value.bankCode} wajib memakai nomor HP valid berformat 628xxx (atau 08xxx).`,
      };
      return;
    }
    cleanNumber = formatted;
    accountForm.value.accountNumber = formatted;
  }

  isSavingPayout.value = true;
  try {
    const cleanHolder = accountForm.value.accountHolderName.trim();
    const res = await api.updatePayoutAccount({
      bankCode: accountForm.value.bankCode,
      accountNumber: cleanNumber,
      accountHolderName: cleanHolder,
    });
    if (res.success) {
      savedAccount.value = {
        bankCode: accountForm.value.bankCode,
        accountNumber: cleanNumber,
        accountHolderName: cleanHolder,
      };
      window.dispatchEvent(new Event("tertaut:payout-account-changed"));
      payoutFeedback.value = {
        type: "success",
        message: "Rekening pencairan berhasil disimpan.",
      };
    } else {
      payoutFeedback.value = {
        type: "error",
        message: res.error || "Gagal menyimpan rekening pencairan.",
      };
    }
  } catch (err: any) {
    payoutFeedback.value = {
      type: "error",
      message: err?.message || "Terjadi kesalahan sistem.",
    };
  } finally {
    isSavingPayout.value = false;
  }
}

async function handleChangePassword() {
  passwordFeedback.value = null;
  const { currentPassword, newPassword, confirmPassword, revokeOtherSessions } = passwordForm.value;

  if (!currentPassword || !newPassword) {
    passwordFeedback.value = {
      type: "error",
      message: "Password saat ini dan password baru wajib diisi.",
    };
    return;
  }
  if (newPassword.length < 8) {
    passwordFeedback.value = {
      type: "error",
      message: "Password baru minimal 8 karakter.",
    };
    return;
  }
  if (newPassword !== confirmPassword) {
    passwordFeedback.value = {
      type: "error",
      message: "Konfirmasi password baru tidak cocok.",
    };
    return;
  }

  isSavingPassword.value = true;
  try {
    const res = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions,
    });
    if ((res as any)?.error) {
      passwordFeedback.value = {
        type: "error",
        message: (res as any).error?.message || "Password saat ini salah atau gagal diubah.",
      };
      return;
    }

    passwordForm.value.currentPassword = "";
    passwordForm.value.newPassword = "";
    passwordForm.value.confirmPassword = "";
    passwordFeedback.value = {
      type: "success",
      message: "Password berhasil diperbarui.",
    };
    if (revokeOtherSessions) {
      await loadSessions();
    }
  } catch (err: any) {
    passwordFeedback.value = {
      type: "error",
      message: err?.message || "Gagal memperbarui password.",
    };
  } finally {
    isSavingPassword.value = false;
  }
}

async function loadSessions() {
  const res = await (authClient as any).listSessions?.().catch(() => null);
  sessions.value = Array.isArray(res?.data) ? res.data : [];
}

async function handleRevokeSession(entry: SessionEntry) {
  const ok = await confirm({
    title: "Cabut Sesi Login",
    message: `Perangkat "${parseDeviceLabel(entry.userAgent)}" harus login ulang setelah sesi dicabut.`,
    confirmText: "Cabut Sesi",
    variant: "danger",
  });
  if (!ok) return;

  sessionFeedback.value = null;
  revokingSessionId.value = entry.id;
  try {
    await (authClient as any).revokeSession?.({ token: entry.token });
    await loadSessions();
    sessionFeedback.value = { type: "success", message: "Sesi berhasil dicabut." };
  } catch (err: any) {
    sessionFeedback.value = {
      type: "error",
      message: err?.message || "Gagal mencabut sesi.",
    };
  } finally {
    revokingSessionId.value = null;
  }
}

async function handleRevokeOtherSessions() {
  const ok = await confirm({
    title: "Cabut Semua Sesi Lain",
    message: "Semua perangkat selain sesi yang Anda gunakan sekarang akan dikeluarkan.",
    confirmText: "Cabut Lainnya",
    variant: "danger",
  });
  if (!ok) return;

  sessionFeedback.value = null;
  isRevokingOthers.value = true;
  try {
    await (authClient as any).revokeOtherSessions?.();
    await loadSessions();
    sessionFeedback.value = {
      type: "success",
      message: "Semua sesi perangkat lain berhasil dicabut.",
    };
  } catch (err: any) {
    sessionFeedback.value = {
      type: "error",
      message: err?.message || "Gagal mencabut sesi lain.",
    };
  } finally {
    isRevokingOthers.value = false;
  }
}

onMounted(() => {
  loadProfile();
});
</script>

<template>
  <div class="animate-fadeIn pb-12">
    <!-- Top Section Toolbar (Obsidian, Full Edge) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex items-center justify-between gap-3 relative"
    >
      <div
        v-if="loading"
        class="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 overflow-hidden"
      >
        <div class="h-full bg-gold animate-pulse w-full"></div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <User class="w-3.5 h-3.5 text-gold shrink-0" />
        <span class="text-xs font-bold text-white uppercase tracking-wider">Profil Builder</span>
        <span class="px-2 py-0.5 rounded-md font-bold text-[10px] bg-white/10 text-gold uppercase">
          {{ userRole }}
        </span>
      </div>

      <button
        type="button"
        @click="loadProfile"
        title="Segarkan"
        class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition shrink-0"
      >
        <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <!-- 1. Identitas & Status Akun (Flush Hairline Grid) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-jetblack/10 border-b border-jetblack/10 bg-white"
    >
      <div class="px-3.5 sm:px-4 md:px-6 py-3.5 space-y-1 min-w-0">
        <div class="text-[10.5px] font-bold uppercase tracking-wider text-jetblack/50">
          Email Akun
        </div>
        <div v-if="loading" class="h-5 w-44 bg-jetblack/10 rounded animate-pulse"></div>
        <template v-else>
          <div class="text-xs sm:text-sm font-bold text-jetblack truncate">
            {{ sessionUser?.email || builder?.email || "-" }}
          </div>
          <div class="flex items-center gap-2 text-[11px]">
            <span
              class="inline-flex items-center gap-1 font-semibold"
              :class="isEmailVerified ? 'text-emerald-700' : 'text-amber-700'"
            >
              <CheckCircle2 v-if="isEmailVerified" class="w-3 h-3" />
              <AlertCircle v-else class="w-3 h-3" />
              {{ isEmailVerified ? "Email Terverifikasi" : "Belum Verifikasi" }}
            </span>
            <button
              v-if="!isEmailVerified && sessionUser?.email"
              type="button"
              :disabled="isSendingVerification || verificationSent"
              @click="handleResendVerification"
              class="text-[11px] font-bold text-[#8a6d1f] underline underline-offset-2 hover:text-gold disabled:opacity-50 cursor-pointer"
            >
              {{
                verificationSent
                  ? "Terkirim"
                  : isSendingVerification
                    ? "Mengirim..."
                    : "Kirim Verifikasi"
              }}
            </button>
          </div>
        </template>
      </div>

      <div class="px-3.5 sm:px-4 md:px-6 py-3.5 space-y-1 min-w-0">
        <div class="text-[10.5px] font-bold uppercase tracking-wider text-jetblack/50">
          Metode Login
        </div>
        <div v-if="loading" class="h-5 w-36 bg-jetblack/10 rounded animate-pulse"></div>
        <template v-else>
          <div class="text-xs sm:text-sm font-bold text-jetblack truncate">
            {{ providerLabels.join(" · ") }}
          </div>
          <div class="text-[11px] text-jetblack/55">
            Bergabung {{ formatDate(sessionUser?.createdAt) }}
          </div>
        </template>
      </div>

      <div class="px-3.5 sm:px-4 md:px-6 py-3.5 space-y-1 min-w-0">
        <div class="text-[10.5px] font-bold uppercase tracking-wider text-jetblack/50">
          Builder ID
        </div>
        <div v-if="loading" class="h-5 w-48 bg-jetblack/10 rounded animate-pulse"></div>
        <template v-else>
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-xs font-mono font-bold text-jetblack/80 truncate">
              {{ builder?.id || "-" }}
            </span>
            <CopyButton v-if="builder?.id" :text="builder.id" title="Salin Builder ID" />
          </div>
          <div class="text-[11px] text-jetblack/55">Identitas entitas merchant &amp; payout</div>
        </template>
      </div>
    </div>

    <!-- 2. Edit Nama Tampilan -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-3 bg-jetblack/[0.02] border-b border-jetblack/10 flex items-center gap-2.5"
    >
      <User class="w-4 h-4 text-jetblack/65 shrink-0" />
      <div>
        <div class="text-xs font-bold text-jetblack">Informasi Profil</div>
        <p class="text-[11px] text-jetblack/60">
          Nama tampilan digunakan pada dashboard, invoice pelanggan, dan direktori builder.
        </p>
      </div>
    </div>

    <form
      @submit.prevent="handleSaveProfile"
      class="-mx-3.5 sm:-mx-4 md:-mx-6 divide-y divide-jetblack/10 border-b border-jetblack/10 bg-white"
    >
      <div
        v-if="profileFeedback"
        class="px-3.5 sm:px-4 md:px-6 py-2.5 text-xs font-semibold flex items-center gap-2"
        :class="
          profileFeedback.type === 'success'
            ? 'bg-emerald-50/60 text-emerald-800'
            : 'bg-red-50/70 text-red-700'
        "
      >
        <CheckCircle2 v-if="profileFeedback.type === 'success'" class="w-4 h-4 shrink-0" />
        <AlertCircle v-else class="w-4 h-4 shrink-0" />
        <span>{{ profileFeedback.message }}</span>
      </div>

      <div
        class="px-3.5 sm:px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-end gap-3 max-w-2xl"
      >
        <div class="flex-1 min-w-0">
          <label class="block text-[11px] font-bold text-jetblack/70 mb-1.5">Nama Tampilan</label>
          <input
            v-model="profileName"
            type="text"
            placeholder="Nama builder atau studio Anda"
            required
            maxlength="100"
            class="w-full h-9 px-3 rounded-lg bg-white border border-jetblack/15 hover:border-jetblack/30 focus:border-gold focus:ring-2 focus:ring-gold/20 text-xs font-bold text-jetblack outline-none transition"
          />
        </div>
        <button
          type="submit"
          :disabled="isSavingProfile || loading"
          class="h-9 px-5 rounded-lg bg-jetblack hover:bg-jetblack/90 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition shrink-0"
        >
          <RefreshCw v-if="isSavingProfile" class="w-3.5 h-3.5 animate-spin" />
          <span>Simpan</span>
        </button>
      </div>
    </form>

    <!-- 3. Rekening Pencairan (Satu Tempat Tunggal) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-3 bg-jetblack/[0.02] border-b border-jetblack/10 flex items-center gap-2.5"
    >
      <Landmark
        class="w-4 h-4 shrink-0"
        :class="savedAccount ? 'text-emerald-600' : 'text-amber-600'"
      />
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-bold text-jetblack">Rekening Pencairan</span>
          <span
            v-if="!loading"
            class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
            :class="savedAccount ? 'text-emerald-700' : 'text-amber-700'"
          >
            <CheckCircle2 v-if="savedAccount" class="w-3 h-3" />
            <AlertCircle v-else class="w-3 h-3" />
            {{ savedAccount ? "Siap Cair" : "Belum Diatur" }}
          </span>
        </div>
        <p class="text-[11px] text-jetblack/60 mt-0.5">
          Rekening tujuan resmi untuk setiap pencairan saldo dari menu Saldo &amp; Payout.
        </p>
      </div>
    </div>

    <form
      @submit.prevent="handleSaveAccount"
      class="-mx-3.5 sm:-mx-4 md:-mx-6 divide-y divide-jetblack/10 border-b border-jetblack/10 bg-white"
    >
      <div
        v-if="payoutFeedback"
        class="px-3.5 sm:px-4 md:px-6 py-2.5 text-xs font-semibold flex items-center gap-2"
        :class="
          payoutFeedback.type === 'success'
            ? 'bg-emerald-50/60 text-emerald-800'
            : 'bg-red-50/70 text-red-700'
        "
      >
        <CheckCircle2 v-if="payoutFeedback.type === 'success'" class="w-4 h-4 shrink-0" />
        <AlertCircle v-else class="w-4 h-4 shrink-0" />
        <span>{{ payoutFeedback.message }}</span>
      </div>

      <div class="px-3.5 sm:px-4 md:px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
        <div>
          <label class="block text-[11px] font-bold text-jetblack/70 mb-1.5">
            Nama Bank / Kanal Payout
          </label>
          <select
            v-model="accountForm.bankCode"
            class="w-full h-9 px-3 rounded-lg bg-white border border-jetblack/15 hover:border-jetblack/30 focus:border-gold focus:ring-2 focus:ring-gold/20 text-xs font-bold text-jetblack outline-none transition"
          >
            <optgroup label="Bank Nasional">
              <option value="MANDIRI">Bank Mandiri</option>
              <option value="BCA">BCA - Bank Central Asia</option>
              <option value="BNI">BNI - Bank Negara Indonesia</option>
              <option value="BRI">BRI - Bank Rakyat Indonesia</option>
              <option value="PERMATA">Bank Permata</option>
              <option value="BSI">BSI - Bank Syariah Indonesia</option>
              <option value="CIMB">CIMB Niaga</option>
              <option value="BNC">BNC - Bank Neo Commerce</option>
              <option value="MEGA">Bank Mega</option>
              <option value="BJB">Bank BJB</option>
              <option value="BTPN">Bank BTPN / Jenius</option>
            </optgroup>
            <optgroup label="E-Wallet (Format 628xxx)">
              <option value="DANA">DANA</option>
              <option value="GOPAY">GoPay</option>
              <option value="OVO">OVO</option>
              <option value="SHOPEEPAY">ShopeePay</option>
              <option value="LINKAJA">LinkAja</option>
            </optgroup>
          </select>
        </div>

        <div>
          <label class="block text-[11px] font-bold text-jetblack/70 mb-1.5">
            {{ isEwalletSelected ? "Nomor HP E-Wallet (628xxx)" : "Nomor Rekening Bank" }}
          </label>
          <input
            v-model="accountForm.accountNumber"
            type="text"
            :placeholder="isEwalletSelected ? 'Contoh: 6281234567890' : 'Contoh: 1234567890'"
            required
            class="w-full h-9 px-3 rounded-lg bg-white border border-jetblack/15 hover:border-jetblack/30 focus:border-gold focus:ring-2 focus:ring-gold/20 text-xs font-mono font-bold text-jetblack outline-none transition"
          />
        </div>

        <div>
          <label class="block text-[11px] font-bold text-jetblack/70 mb-1.5">
            Nama Pemilik Rekening
          </label>
          <input
            v-model="accountForm.accountHolderName"
            type="text"
            placeholder="Sesuai buku tabungan"
            required
            class="w-full h-9 px-3 rounded-lg bg-white border border-jetblack/15 hover:border-jetblack/30 focus:border-gold focus:ring-2 focus:ring-gold/20 text-xs font-bold text-jetblack outline-none transition"
          />
        </div>
      </div>

      <div class="px-3.5 sm:px-4 md:px-6 py-3 bg-jetblack/[0.015] flex items-center justify-end">
        <button
          type="submit"
          :disabled="isSavingPayout || loading"
          class="h-9 px-5 btn-gold rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 shadow-2xs"
        >
          <RefreshCw v-if="isSavingPayout" class="w-3.5 h-3.5 animate-spin" />
          <span>Simpan</span>
        </button>
      </div>
    </form>

    <!-- 4. Keamanan & Ubah Password -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-3 bg-jetblack/[0.02] border-b border-jetblack/10 flex items-center gap-2.5"
    >
      <Lock class="w-4 h-4 text-jetblack/65 shrink-0" />
      <div>
        <div class="text-xs font-bold text-jetblack">Keamanan &amp; Password</div>
        <p class="text-[11px] text-jetblack/60">
          Kelola kredensial login untuk menjaga keamanan akun developer Anda.
        </p>
      </div>
    </div>

    <div
      v-if="!loading && !hasCredentialAccount"
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-4 border-b border-jetblack/10 bg-white flex items-center gap-2.5 text-xs text-jetblack/70"
    >
      <ShieldCheck class="w-4 h-4 text-forest shrink-0" />
      <span>
        Akun ini login melalui penyedia eksternal ({{ providerLabels.join(", ") }}). Pengaturan
        password dikelola oleh penyedia tersebut.
      </span>
    </div>

    <form
      v-else
      @submit.prevent="handleChangePassword"
      class="-mx-3.5 sm:-mx-4 md:-mx-6 divide-y divide-jetblack/10 border-b border-jetblack/10 bg-white"
    >
      <div
        v-if="passwordFeedback"
        class="px-3.5 sm:px-4 md:px-6 py-2.5 text-xs font-semibold flex items-center gap-2"
        :class="
          passwordFeedback.type === 'success'
            ? 'bg-emerald-50/60 text-emerald-800'
            : 'bg-red-50/70 text-red-700'
        "
      >
        <CheckCircle2 v-if="passwordFeedback.type === 'success'" class="w-4 h-4 shrink-0" />
        <AlertCircle v-else class="w-4 h-4 shrink-0" />
        <span>{{ passwordFeedback.message }}</span>
      </div>

      <div class="px-3.5 sm:px-4 md:px-6 py-4 space-y-3 max-w-4xl">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-[11px] font-bold text-jetblack/70 mb-1.5">
              Password Saat Ini
            </label>
            <input
              v-model="passwordForm.currentPassword"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
              required
              class="w-full h-9 px-3 rounded-lg bg-white border border-jetblack/15 hover:border-jetblack/30 focus:border-gold focus:ring-2 focus:ring-gold/20 text-xs text-jetblack outline-none transition"
            />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-jetblack/70 mb-1.5">
              Password Baru
            </label>
            <input
              v-model="passwordForm.newPassword"
              type="password"
              autocomplete="new-password"
              minlength="8"
              placeholder="Minimal 8 karakter"
              required
              class="w-full h-9 px-3 rounded-lg bg-white border border-jetblack/15 hover:border-jetblack/30 focus:border-gold focus:ring-2 focus:ring-gold/20 text-xs text-jetblack outline-none transition"
            />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-jetblack/70 mb-1.5">
              Konfirmasi Password Baru
            </label>
            <input
              v-model="passwordForm.confirmPassword"
              type="password"
              autocomplete="new-password"
              minlength="8"
              placeholder="Ulangi password baru"
              required
              class="w-full h-9 px-3 rounded-lg bg-white border border-jetblack/15 hover:border-jetblack/30 focus:border-gold focus:ring-2 focus:ring-gold/20 text-xs text-jetblack outline-none transition"
            />
          </div>
        </div>

        <label class="inline-flex items-center gap-2 text-xs text-jetblack/75 cursor-pointer">
          <input
            v-model="passwordForm.revokeOtherSessions"
            type="checkbox"
            class="w-3.5 h-3.5 rounded border-jetblack/30 text-jetblack focus:ring-gold"
          />
          <span>Cabut semua sesi perangkat lain setelah password diubah</span>
        </label>
      </div>

      <div class="px-3.5 sm:px-4 md:px-6 py-3 bg-jetblack/[0.015] flex items-center justify-end">
        <button
          type="submit"
          :disabled="isSavingPassword || loading"
          class="h-9 px-5 rounded-lg bg-jetblack hover:bg-jetblack/90 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
        >
          <RefreshCw v-if="isSavingPassword" class="w-3.5 h-3.5 animate-spin" />
          <span>Ubah</span>
        </button>
      </div>
    </form>

    <!-- 5. Sesi Login Aktif -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-3 bg-jetblack/[0.02] border-b border-jetblack/10 flex items-center justify-between gap-3"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <Monitor class="w-4 h-4 text-jetblack/65 shrink-0" />
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-jetblack">Sesi Login Aktif</span>
            <span class="text-[10.5px] font-mono font-bold text-jetblack/55">
              {{ sessions.length }} sesi
            </span>
          </div>
          <p class="text-[11px] text-jetblack/60 truncate">
            Daftar perangkat yang sedang masuk menggunakan akun ini.
          </p>
        </div>
      </div>

      <button
        v-if="sessions.length > 1"
        type="button"
        :disabled="isRevokingOthers"
        @click="handleRevokeOtherSessions"
        class="h-8 px-3 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 text-xs font-bold transition cursor-pointer disabled:opacity-50 shrink-0"
      >
        {{ isRevokingOthers ? "Mencabut..." : "Cabut Lainnya" }}
      </button>
    </div>

    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 divide-y divide-jetblack/10 border-b border-jetblack/10 bg-white"
    >
      <div
        v-if="sessionFeedback"
        class="px-3.5 sm:px-4 md:px-6 py-2.5 text-xs font-semibold flex items-center gap-2"
        :class="
          sessionFeedback.type === 'success'
            ? 'bg-emerald-50/60 text-emerald-800'
            : 'bg-red-50/70 text-red-700'
        "
      >
        <CheckCircle2 v-if="sessionFeedback.type === 'success'" class="w-4 h-4 shrink-0" />
        <AlertCircle v-else class="w-4 h-4 shrink-0" />
        <span>{{ sessionFeedback.message }}</span>
      </div>

      <div
        v-if="!loading && sessions.length === 0"
        class="px-3.5 sm:px-4 md:px-6 py-5 text-xs text-jetblack/55"
      >
        Tidak ada sesi aktif yang tercatat.
      </div>

      <div
        v-for="entry in sessions"
        :key="entry.id"
        class="px-3.5 sm:px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
      >
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-bold text-jetblack">
              {{ parseDeviceLabel(entry.userAgent) }}
            </span>
            <span
              v-if="entry.id === currentSessionId"
              class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700"
            >
              <CheckCircle2 class="w-3 h-3" />
              Sesi Ini
            </span>
          </div>
          <div class="text-[11px] text-jetblack/55 font-mono mt-0.5 truncate">
            {{ entry.ipAddress || "IP tidak tercatat" }} · Login {{ formatDate(entry.createdAt) }}
          </div>
        </div>

        <button
          v-if="entry.id !== currentSessionId"
          type="button"
          :disabled="revokingSessionId === entry.id"
          @click="handleRevokeSession(entry)"
          class="self-start sm:self-auto px-3 py-1 rounded-lg border border-jetblack/15 hover:border-red-300 hover:bg-red-50 hover:text-red-700 text-xs font-bold text-jetblack/75 transition cursor-pointer disabled:opacity-50"
        >
          {{ revokingSessionId === entry.id ? "Mencabut..." : "Cabut" }}
        </button>
      </div>
    </div>
  </div>
</template>
