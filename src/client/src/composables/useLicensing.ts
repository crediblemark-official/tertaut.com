import { ref, onUnmounted } from "vue";
import { api } from "../lib/api";
import type { AppItem } from "../types/app";
import type {
  LicenseConfigItem,
  LicenseItem,
  LicensePlatform,
  SaveLicenseConfigPayload,
} from "../types/licensing";
import { useConfirm } from "./useConfirm";

export function useLicensing() {
  const appsList = ref<AppItem[]>([]);
  const configsList = ref<LicenseConfigItem[]>([]);
  const licensesList = ref<LicenseItem[]>([]);
  const loadingData = ref(true);

  const actionFeedback = ref<string | null>(null);
  let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  const { confirm: confirmDialog } = useConfirm();

  function setFeedback(msg: string, timeoutMs = 4000) {
    if (feedbackTimer) clearTimeout(feedbackTimer);
    actionFeedback.value = msg;
    feedbackTimer = setTimeout(() => {
      actionFeedback.value = null;
      feedbackTimer = null;
    }, timeoutMs);
  }

  function notifyLicensesChanged() {
    window.dispatchEvent(new Event("tertaut:licenses-changed"));
  }

  onUnmounted(() => {
    if (feedbackTimer) {
      clearTimeout(feedbackTimer);
      feedbackTimer = null;
    }
  });

  async function loadData() {
    loadingData.value = true;
    try {
      const [appsRes, configsRes, licRes] = await Promise.all([
        api.getApps(),
        api.getLicenseConfigs(),
        api.getLicenses(),
      ]);
      appsList.value = appsRes.apps || [];
      configsList.value = configsRes.configs || [];
      licensesList.value = licRes.licenses || [];
    } catch (err) {
      console.error("Gagal memuat data lisensi:", err);
    } finally {
      loadingData.value = false;
    }
  }

  async function saveConfig(payload: SaveLicenseConfigPayload): Promise<boolean> {
    try {
      const res = await api.saveLicenseConfig(payload);
      if (res.success) {
        setFeedback("Pengaturan lisensi berhasil disimpan & diterapkan!", 4000);
        await loadData();
        return true;
      } else {
        setFeedback(`Gagal: ${res.error || "Terjadi kesalahan"}`, 4000);
        return false;
      }
    } catch (err: any) {
      setFeedback(`Error: ${err?.message || "Gagal menyimpan"}`, 4000);
      return false;
    }
  }

  async function issueLicense(payload: {
    appId: string;
    customerEmail: string;
    grantDays: number;
    maxSeats: number;
    platform: LicensePlatform;
  }): Promise<boolean> {
    try {
      const res = await api.issueLicense(payload);
      if (res.success && res.license) {
        setFeedback(`Lisensi baru ${res.license.licenseKey || ""} berhasil diterbitkan!`, 5000);
        await loadData();
        notifyLicensesChanged();
        return true;
      }
      return false;
    } catch (err: any) {
      setFeedback(`Error: ${err?.message || "Gagal menerbitkan lisensi"}`, 4000);
      return false;
    }
  }

  async function revokeLicense(lic: LicenseItem): Promise<boolean> {
    const confirmed = await confirmDialog({
      title: "Cabut Lisensi?",
      message: `Lisensi ${lic.licenseKey} milik ${lic.customerEmail} akan dibatalkan dan semua perangkat terikat akan diputus.`,
      confirmText: "Cabut Lisensi",
      cancelText: "Batal",
      variant: "danger",
    });
    if (!confirmed) return false;

    try {
      const res = await api.revokeLicense(lic.licenseKey);
      if (res.success) {
        setFeedback(`Lisensi ${lic.licenseKey} berhasil dicabut.`, 4000);
        await loadData();
        notifyLicensesChanged();
        return true;
      }
      return false;
    } catch (e: any) {
      setFeedback(`Error: ${e?.message || "Gagal mencabut lisensi"}`, 4000);
      return false;
    }
  }

  async function reactivateLicense(lic: LicenseItem | string): Promise<boolean> {
    const licenseKey = typeof lic === "string" ? lic : lic.licenseKey;
    try {
      const res = await api.reactivateLicense(licenseKey);
      if (res.success) {
        setFeedback(`Lisensi ${licenseKey} berhasil diaktifkan kembali!`, 4000);
        await loadData();
        notifyLicensesChanged();
        return true;
      } else {
        setFeedback(`Gagal: ${res.error || "Gagal mengaktifkan lisensi"}`, 4000);
        return false;
      }
    } catch (e: any) {
      setFeedback(`Error: ${e?.message || "Terjadi kesalahan"}`, 4000);
      return false;
    }
  }

  async function renewExpiry(payload: {
    licenseKey: string;
    additionalDays?: number;
    newExpiresAt?: string | null;
    isLifetime?: boolean;
  }): Promise<boolean> {
    try {
      const res = await api.renewLicense({
        licenseKey: payload.licenseKey,
        additionalDays: payload.additionalDays,
        newExpiresAt: payload.newExpiresAt,
        isLifetime: payload.isLifetime,
      });
      if (res.success) {
        setFeedback(res.message || "Masa aktif lisensi berhasil diperbarui!", 4000);
        await loadData();
        return true;
      } else {
        setFeedback(`Gagal: ${res.error || "Gagal mengubah masa aktif"}`, 4000);
        return false;
      }
    } catch (e: any) {
      setFeedback(`Error: ${e?.message || "Terjadi kesalahan"}`, 4000);
      return false;
    }
  }

  async function unbindHardware(lic: LicenseItem): Promise<boolean> {
    try {
      const res = await api.unbindHardware(lic.licenseKey);
      if (res.success) {
        setFeedback(
          `Hardware binding untuk ${lic.licenseKey} berhasil di-reset. Pengguna dapat aktivasi di device baru.`,
          4000
        );
        await loadData();
        return true;
      }
      return false;
    } catch (e: any) {
      setFeedback(`Error: ${e?.message || "Gagal reset hardware"}`, 4000);
      return false;
    }
  }

  async function deactivateSeat(licenseKey: string, hwid: string): Promise<boolean> {
    try {
      const res = await api.deactivateLicense({ licenseKey, hwid });
      if (res.success) {
        setFeedback("Device seat berhasil dilepas!", 4000);
        await loadData();
        return true;
      } else {
        setFeedback(`Gagal: ${res.error || "Seat tidak bisa dilepas"}`, 4000);
        return false;
      }
    } catch (e: any) {
      setFeedback(`Error: ${e?.message || "Terjadi kesalahan"}`, 4000);
      return false;
    }
  }

  return {
    appsList,
    configsList,
    licensesList,
    loadingData,
    actionFeedback,
    setFeedback,
    loadData,
    saveConfig,
    issueLicense,
    revokeLicense,
    reactivateLicense,
    renewExpiry,
    unbindHardware,
    deactivateSeat,
  };
}
