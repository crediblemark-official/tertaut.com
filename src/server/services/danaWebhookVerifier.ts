import { config } from "../config";
import crypto from "crypto";
import { WebhookParser } from "dana-node/webhook/v1";

/**
 * Verifikasi Webhook DANA Finish Payment & Disburse Notify menggunakan WebhookParser dana-node
 *
 * Aturan keamanan (BUG-3): begitu public key DANA dikonfigurasi, signature webhook
 * WAJIB diverifikasi di SEMUA environment — termasuk sandbox. Sebelumnya sandbox
 * menerima webhook tanpa signature meskipun public key sudah dipasang, sehingga
 * webhook palsu bisa diterima di deployment non-produksi.
 * Bypass hanya berlaku saat TIDAK ada public key sama sekali (mode mock UAT murni).
 */
export class DanaWebhookVerifier {
  static verify(
    headers: Record<string, string | undefined>,
    body: unknown,
    options?: { method?: string; path?: string }
  ): boolean {
    // Sandbox/dev murni TANPA public key: mode UAT mock, tidak ada kunci yang bisa
    // diverifikasi sehingga webhook DANA (yang umumnya tanpa signature di UAT) tetap
    // diproses. Jangan bypass jika public key sudah tersedia!
    if (config.isSandbox && !config.dana.publicKey) {
      return true;
    }

    const signature = headers["signature"] || headers["x-signature"] || headers["X-SIGNATURE"];
    if (!signature) {
      console.warn("[DanaWebhookVerifier] Missing signature header in DANA webhook.");
      return false;
    }

    // Jika public key RSA tersedia, verifikasi via SDK WebhookParser atau fallback crypto
    if (config.dana.publicKey) {
      try {
        if (options?.method && options?.path) {
          const parser = new WebhookParser(config.dana.publicKey);
          const rawHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(headers)) {
            if (v !== undefined) rawHeaders[k] = v;
          }
          const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
          parser.parseWebhook(options.method, options.path, rawHeaders, bodyStr);
          return true;
        }
      } catch {
        // Fallback ke verifikasi RSA standar
      }

      try {
        const rawPubKey = config.dana.publicKey;
        const pubKeyPem = rawPubKey.includes("-----BEGIN")
          ? rawPubKey
          : `-----BEGIN PUBLIC KEY-----\n${rawPubKey.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;
        const verifier = crypto.createVerify("SHA256");
        verifier.update(typeof body === "string" ? body : JSON.stringify(body));
        return verifier.verify(pubKeyPem, signature, "base64");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn("[DanaWebhookVerifier] Signature verification exception:", message);
        return false;
      }
    }

    if (!config.isSandbox) {
      console.error(
        "[DanaWebhookVerifier] DANA public key tidak dikonfigurasi di production. Webhook ditolak demi keamanan."
      );
      return false;
    }

    return true;
  }
}
