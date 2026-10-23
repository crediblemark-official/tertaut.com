/**
 * Registry payment gateway — SATU-SATUNYA sumber kebenaran mengenai gateway
 * mana saja yang tersedia.
 *
 * Sebelumnya allowlist nama gateway tercecer di lima tempat
 * (`paymentGateway.ts`, `panel/settings.ts`, `apps/queries.ts`,
 * `ensureSettings.ts`, `__test/setup.ts`). Akibatnya menghapus satu gateway
 * berarti lima edit, dan tidak ada yang gagal bila satu tempat lupa.
 *
 * Semua pihak kini menanyakan daftar di sini. Menghapus gateway = hapus satu
 * baris dari `GATEWAY_IDS` + satu entri dari `GATEWAY_REGISTRY` (dan folder
 * adapter-nya). Tipe `GatewayId` ikut menyempit sendiri.
 */

/** Id gateway yang terdaftar. Xendit adalah gateway pembayaran riil; sandbox hanya simulasi. */
export const GATEWAY_IDS = ["xendit", "sandbox"] as const;

export type GatewayId = (typeof GATEWAY_IDS)[number];

/** Alias yang diterima untuk menunjuk gateway tertentu. */
const GATEWAY_ALIASES: Record<string, GatewayId> = {
  xendit: "xendit",
  sandbox: "sandbox",
};

export const DEFAULT_GATEWAY_ID: GatewayId = "xendit";

/**
 * Metadata gateway yang dibutuhkan logika bisnis, supaya tidak lagi bercabang
 * dengan `if (gateway === "xendit")` di banyak tempat.
 */
export interface GatewayDescriptor {
  readonly id: GatewayId;
  readonly displayName: string;
  /** Payment rail yang benar-benar didukung gateway ini. */
  readonly rails: readonly string[];
  /** Path redirect pembeli setelah pembayaran. */
  readonly finishPath: string;
  /** Bank default untuk rail virtual account. */
  readonly defaultVaBank: string;
  /**
   * Label `paymentChannel` yang disimpan untuk rail QRIS. Xendit memakai
   * "XENDIT_QRIS" (format lama yang sudah tersimpan di data transaksi lama);
   * gateway lain memakai "QRIS". Disimpan di sini supaya logika checkout tidak
   * perlu memeriksa nama gateway.
   */
  readonly qrChannelLabel: string;
  /**
   * Kredensial gateway: `platformKey` di `platform_settings` → env var yang
   * menjadi sumber nilainya. Disimpan di sini agar menghapus gateway ikut
   * menghapus jalur seeding-nya (dulu `ensureSettings.ts` punya daftar sendiri).
   */
  readonly credentials: Readonly<Record<string, readonly string[]>>;

  /**
   * Nomor rekening simulasi yang dipakai untuk payout di sandbox. Gateway yang
   * punya ini mengizinkan pencairan dari aplikasi mode sandbox; gateway lain
   * menolaknya demi mencegah transfer ke rekening mock.
   */
  readonly sandboxPayoutAccountNumber?: string;

  readonly unsupportedWhen?: (ctx: {
    rail: string;
    ewalletChannel?: string;
    bankCode?: string;
  }) => boolean;
}

const CARD_RAILS = ["qris", "va", "ewallet", "card", "retail"] as const;

export const GATEWAY_REGISTRY: Readonly<Record<GatewayId, GatewayDescriptor>> = {
  xendit: {
    id: "xendit",
    displayName: "Xendit",
    rails: CARD_RAILS,
    finishPath: "/checkout/success",
    defaultVaBank: "BCA",
    qrChannelLabel: "XENDIT_QRIS",
    credentials: {
      xendit_secret_key: ["XENDIT_SECRET_KEY", "XENDIT_SANDBOX_SECRET_KEY"],
      xendit_webhook_token: ["XENDIT_WEBHOOK_VERIFICATION_TOKEN", "XENDIT_WEBHOOK_TOKEN"],
      xendit_public_key: ["XENDIT_PUBLIC_KEY"],
    },
  },
  sandbox: {
    id: "sandbox",
    displayName: "Tertaut Sandbox (Simulasi)",
    rails: CARD_RAILS,
    finishPath: "/checkout/success",
    defaultVaBank: "BCA",
    qrChannelLabel: "QRIS",
    sandboxPayoutAccountNumber: "1234567890",
    credentials: {},
  },
};

/**
 * Seluruh pasangan (platformKey → envKeys) dari seluruh gateway terdaftar.
 * Dipakai `ensureSettings` untuk seeding kredensial tanpa daftar terpisah.
 */
export function allCredentialEnvSources(): Array<[platformKey: string, envKeys: string[]]> {
  return GATEWAY_LIST.flatMap((g) =>
    Object.entries(g.credentials).map(([key, envs]) => [key, [...envs]] as [string, string[]])
  );
}

/** Seluruh kunci kredensial yang harus dibuat di platform_settings. */
export function allCredentialKeys(): string[] {
  return GATEWAY_LIST.flatMap((g) => Object.keys(g.credentials));
}

/** Daftar descriptor dalam urutan registrasi. */
export const GATEWAY_LIST: readonly GatewayDescriptor[] = GATEWAY_IDS.map(
  (id) => GATEWAY_REGISTRY[id]
);

export function isRegisteredGatewayId(value: unknown): value is GatewayId {
  return typeof value === "string" && (GATEWAY_IDS as readonly string[]).includes(value.trim());
}

/**
 * Normalisasi nama gateway dari sumber mana pun (env, DB, request body).
 * Mengembalikan `null` bila tidak dikenal.
 */
export function normalizeGatewayId(value: unknown): GatewayId | null {
  if (typeof value !== "string") return null;
  const resolved = GATEWAY_ALIASES[value.toLowerCase().trim()];
  return resolved ?? null;
}

/** Descriptor gateway, atau `undefined` bila tidak terdaftar. */
export function getGatewayDescriptor(id: unknown): GatewayDescriptor | undefined {
  const normalized = normalizeGatewayId(id);
  return normalized ? GATEWAY_REGISTRY[normalized] : undefined;
}

export interface RailContext {
  rail?: string | null;
  ewalletChannel?: string | null;
  bankCode?: string | null;
}

/**
 * Apakah gateway mendukung rail (dan detailnya)? Rail yang tidak didukung akan
 * ditolak gateway, jadi lebih baik dialihkan sebelum order dibuat.
 */
export function gatewaySupportsRail(
  id: unknown,
  ctx: RailContext | string | null | undefined
): boolean {
  const descriptor = getGatewayDescriptor(id);
  if (!descriptor) return false;

  const c: RailContext = typeof ctx === "string" ? { rail: ctx } : (ctx ?? {});
  // Rail kosong → server memakai default dari produk, selalu sah.
  if (!c.rail) return true;

  const rail = c.rail.toLowerCase().trim();
  if (!descriptor.rails.includes(rail)) return false;

  if (descriptor.unsupportedWhen) {
    return !descriptor.unsupportedWhen({
      rail,
      ewalletChannel: c.ewalletChannel ?? undefined,
      bankCode: c.bankCode ?? undefined,
    });
  }
  return true;
}

/**
 * Pilih gateway terdaftar pertama yang mendukung rail+detail. `null` bila
 * tidak ada satu pun yang mendukung.
 */
export function resolveGatewayForRail(ctx: RailContext): GatewayId | null {
  return GATEWAY_IDS.find((id) => gatewaySupportsRail(id, ctx)) ?? null;
}

/** Apakah gateway mengizinkan payout dari aplikasi mode sandbox? */
export function gatewayAllowsSandboxPayout(id: unknown): boolean {
  return Boolean(getGatewayDescriptor(id)?.sandboxPayoutAccountNumber);
}

/** Daftar rail dari `rails` yang tidak didukung gateway `id`. */
export function unsupportedRails(id: unknown, rails: readonly string[]): string[] {
  const descriptor = getGatewayDescriptor(id);
  if (!descriptor) return [];
  return rails.filter((r) => !descriptor.rails.includes(r));
}
