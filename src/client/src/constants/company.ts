/**
 * Informasi Resmi Badan Hukum & Kontak Perusahaan
 * Digunakan untuk legalitas, verifikasi payment gateway, halaman kontak, dan footer.
 */

export const COMPANY_INFO = {
  legalName: "PT RETAS LINTAS BATAS",
  brandName: "Tertaut",
  websiteUrl: "https://tertaut.com",
  address: {
    street: "Jl. Raya Batang-Batang",
    regency: "Kab. Sumenep",
    province: "Jawa Timur",
    country: "Indonesia",
    full: "Jl. Raya Batang-Batang, Kab. Sumenep, Jawa Timur, Indonesia",
  },
  contact: {
    phone: "+62 851-8313-1249",
    phoneDisplay: "+62 851-8313-1249",
    whatsapp: "6285183131249",
    whatsappUrl:
      "https://wa.me/6285183131249?text=Halo%20Admin%20PT%20RETAS%20LINTAS%20BATAS%20(Tertaut),%20saya%20ingin%20bertanya%20mengenai%20layanan%20Merchant%20of%20Record.",
    email: "retaslintasbatas@gmail.com",
    supportEmail: "retaslintasbatas@gmail.com",
  },
  operatingHours: "Senin – Jumat: 08:30 – 17:00 WIB",
  businessType: "Penyedia Merchant of Record (MoR) Software, Lisensi Digital, & Gateway Pembayaran",
};

export interface PricingPlan {
  name: string;
  badge?: string;
  priceLabel: string;
  periodLabel: string;
  feeLabel: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaLink: string;
  popular?: boolean;
}

export const PLATFORM_PRICING: PricingPlan = {
  name: "Tertaut Platform Builder",
  badge: "100% Gratis Mulai",
  priceLabel: "Rp 0",
  periodLabel: "Gratis Selamanya • Tanpa Biaya Bulanan",
  feeLabel: "5% Flat Fee per transaksi sukses (Tanpa biaya jika tidak ada penjualan)",
  description:
    "Semua fitur platform Tertaut sepenuhnya gratis digunakan oleh para software builder, developer indie, dan kreator SaaS di Indonesia. Anda hanya membayar flat 5% saat Anda berhasil menjual software.",
  features: [
    "Pendaftaran akun gratis tanpa biaya setup atau biaya berlangganan",
    "Terima pembayaran instan via QRIS (semua e-wallet & m-banking) & Virtual Account",
    "Faktur pajak elektronik resmi (PPN 11%) diterbitkan otomatis oleh PT RETAS LINTAS BATAS",
    "Pencairan otomatis: 95% pendapatan bersih langsung ke rekening bank lokal Anda",
    "Universal Licensing SDK (@tertaut/sdk): Lisensi Ed25519 offline 30 hari & hardware seat binding",
    "AI Proxy Shield: Enkripsi AES-256 master API key, rate limit 15 req/menit & daily token cap",
    "Embeddable Trust Badge & hosted checkout page yang mobile-friendly",
    "Dashboard analitik real-time, audit log, pelaporan pajak, dan manajemen kupon diskon",
  ],
  ctaText: "Daftar Gratis Sekarang",
  ctaLink: "/login",
  popular: true,
};
