export interface BankOption {
  id: string;
  label: string;
  fullName: string;
  code: string;
}

export interface PaymentRailOption {
  id: "qris" | "va" | "ewallet" | "card" | "retail";
  name: string;
  shortLabel: string;
  badge?: string;
  description: string;
  channels: string[];
}

/**
 * 9 Bank Besar Virtual Account Resmi yang didukung tertaut.com melalui Xendit
 */
export const SUPPORTED_BANKS: BankOption[] = [
  { id: "BCA", label: "BCA", fullName: "Bank Central Asia", code: "3901" },
  { id: "MANDIRI", label: "Mandiri", fullName: "Bank Mandiri", code: "88888" },
  { id: "BNI", label: "BNI", fullName: "Bank Negara Indonesia", code: "8808" },
  { id: "BRI", label: "BRI", fullName: "Bank Rakyat Indonesia", code: "12800" },
  { id: "BSI", label: "BSI", fullName: "Bank Syariah Indonesia", code: "900" },
  { id: "CIMB", label: "CIMB", fullName: "CIMB Niaga", code: "5919" },
  { id: "PERMATA", label: "Permata", fullName: "Permata Bank", code: "8528" },
  { id: "BJB", label: "BJB", fullName: "Bank BJB", code: "014" },
  { id: "SAHABAT_SAMPOERNA", label: "BSS", fullName: "Bank Sahabat Sampoerna", code: "522" },
];

/**
 * Seluruh Jalur Rel Pembayaran (Payment Rails) yang aktif di platform
 */
export const PAYMENT_RAILS: PaymentRailOption[] = [
  {
    id: "qris",
    name: "QRIS Dinamis Instan",
    shortLabel: "QRIS",
    description: "Scan QR dengan aplikasi bank atau e-wallet apa saja",
    channels: [
      "BCA Mobile",
      "Livin' Mandiri",
      "BRImo",
      "BNI Mobile",
      "GoPay",
      "OVO",
      "DANA",
      "ShopeePay",
    ],
  },
  {
    id: "va",
    name: "Virtual Account (9 Bank)",
    shortLabel: "Virtual Account",
    description: "Nomor rekening virtual account otomatis terverifikasi",
    channels: [
      "BCA",
      "Mandiri",
      "BNI",
      "BRI",
      "BSI",
      "CIMB Niaga",
      "Permata",
      "BJB",
      "Bank Sahabat Sampoerna",
    ],
  },
  {
    id: "ewallet",
    name: "E-Wallet Nasional",
    shortLabel: "E-Wallet",
    description: "Bayar cepat menggunakan saldo dompet digital favorit",
    channels: ["GoPay", "OVO", "DANA", "ShopeePay", "LinkAja", "AstraPay", "JeniusPay"],
  },
  {
    id: "card",
    name: "Kartu Kredit & Debit",
    shortLabel: "Kartu Kredit/Debit",
    description: "Pembayaran internasional & domestik dengan proteksi 3D-Secure",
    channels: ["Visa", "Mastercard", "JCB", "American Express"],
  },
  {
    id: "retail",
    name: "Gerai Minimarket Retail",
    shortLabel: "Minimarket",
    description: "Bayar tunai melalui kasir gerai retail seluruh Indonesia",
    channels: ["Alfamart", "Indomaret", "Alfamidi", "Dan+Dan"],
  },
];

export interface EwalletOption {
  id: string;
  label: string;
  accent: string;
}

export const SUPPORTED_EWALLETS: EwalletOption[] = [
  { id: "OVO", label: "OVO", accent: "#4c2a86" },
  { id: "SHOPEEPAY", label: "ShopeePay", accent: "#ee4d2d" },
  { id: "DANA", label: "DANA", accent: "#108ee9" },
  { id: "ASTRAPAY", label: "AstraPay", accent: "#0047ba" },
  { id: "LINKAJA", label: "LinkAja", accent: "#ed1c24" },
  { id: "JENIUSPAY", label: "JeniusPay", accent: "#00a1e4" },
  { id: "GOPAY", label: "GoPay", accent: "#00aed6" },
];

export interface RetailOption {
  id: string;
  label: string;
}

export const SUPPORTED_RETAILS: RetailOption[] = [
  { id: "ALFAMART", label: "Alfamart" },
  { id: "INDOMARET", label: "Indomaret" },
];
