import { ref } from 'vue'

/**
 * Environment dashboard global (ala creem.io): Live vs Sandbox.
 * Environment menentukan data mana yang ditampilkan (apps/transaksi/lisensi/kupon
 * difilter berdasarkan apps.mode) dan perilaku checkout.
 */
export type DashboardEnv = 'live' | 'sandbox'

export const SANDBOX_PREFIX = '/dashboard/sandbox'

function envFromPath(path: string): DashboardEnv {
  return path === SANDBOX_PREFIX || path.startsWith(`${SANDBOX_PREFIX}/`) ? 'sandbox' : 'live'
}

export const dashboardEnv = ref<DashboardEnv>(
  typeof window !== 'undefined' ? envFromPath(window.location.pathname) : 'live'
)

export function applyEnvFromPath(path: string) {
  dashboardEnv.value = envFromPath(path)
}

/** Bangun path dashboard untuk environment tertentu, mis. ('sandbox', '/checkout'). */
export function envPath(env: DashboardEnv, subPath = ''): string {
  const base = env === 'sandbox' ? SANDBOX_PREFIX : '/dashboard'
  const suffix = subPath ? (subPath.startsWith('/') ? subPath : `/${subPath}`) : ''
  return `${base}${suffix}`
}
