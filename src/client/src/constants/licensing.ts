/**
 * Label Indonesia resmi untuk seluruh event lifecycle webhook lisensi & metering
 */
export const WEBHOOK_EVENT_LABELS: Record<string, string> = {
  "license.issued": "License Diterbitkan",
  "license.activated": "License Diaktifkan",
  "license.deactivated": "License Di-deactivate",
  "license.seat_full": "Seat Penuh",
  "license.revoked": "License Dicabut (Revoke)",
  "license.expired": "License Kadaluarsa",
  "license.renewed": "License Diperpanjang",
  "license.transferred": "License Dipindah",
  "license.unbound": "Hardware Unbound",
  "credits.insufficient": "Kredit Tidak Cukup",
};

/**
 * Label aktivitas audit lisensi
 */
export const LICENSE_ACTIVITY_LABELS: Record<string, string> = {
  "license.issued": "Lisensi diterbitkan",
  "license.activated": "Perangkat diaktifkan",
  "license.deactivated": "Seat perangkat dilepas",
  "license.seat_full": "Seat penuh (aktivasi ditolak)",
  "license.revoked": "Lisensi dicabut",
  "license.expired": "Lisensi kadaluarsa",
  "license.renewed": "Lisensi diperpanjang",
  "license.transferred": "Lisensi dipindahkan",
};
