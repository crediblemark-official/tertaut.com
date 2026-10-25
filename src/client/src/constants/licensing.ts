/**
 * Label Indonesia resmi untuk seluruh event lifecycle webhook & audit lisensi
 */
export const WEBHOOK_EVENT_LABELS: Record<string, string> = {
  "license.issued": "Lisensi Diterbitkan",
  "license.activated": "Perangkat Diaktifkan",
  "license.deactivated": "Seat Perangkat Dilepas",
  "license.seat_full": "Seat Penuh",
  "license.revoked": "Lisensi Dicabut (Revoke)",
  "license.reactivated": "Lisensi Diaktifkan Kembali",
  "license.expired": "Lisensi Kadaluarsa",
  "license.renewed": "Lisensi Diperpanjang",
  "license.transferred": "Lisensi Dipindahkan",
  "license.unbound": "Hardware Unbound",
};

/**
 * Alias untuk label aktivitas audit lisensi (DRY)
 */
export const LICENSE_ACTIVITY_LABELS: Record<string, string> = WEBHOOK_EVENT_LABELS;
