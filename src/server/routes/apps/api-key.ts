import { randomBytes } from "crypto";

export type AppMode = "sandbox" | "live";

/**
 * Prefix publishable API key per aplikasi (pola publishable-key):
 * `tt_test_...` untuk sandbox, `tt_live_...` untuk produksi.
 */
export function appApiKeyPrefix(mode: AppMode): "tt_test_" | "tt_live_" {
  return mode === "sandbox" ? "tt_test_" : "tt_live_";
}

/** Generate publishable API key baru untuk sebuah aplikasi. */
export function generateAppApiKey(mode: AppMode): string {
  return `${appApiKeyPrefix(mode)}${randomBytes(16).toString("hex")}`;
}

/** Generate secret API key baru untuk server-to-server (S2S) — rahasia, hanya untuk backend. */
export function generateBuilderSecretApiKey(): string {
  return `tt_secret_${randomBytes(24).toString("hex")}`;
}

/** True jika string adalah secret API key builder (`tt_secret_...`). */
export function isBuilderSecretApiKey(key: string): boolean {
  return /^tt_secret_[a-f0-9]+$/i.test(key.trim());
}
