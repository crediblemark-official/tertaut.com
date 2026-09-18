import { config } from "../config";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

/**
 * Pengiriman email transaksional via Resend (REST API, tanpa dependency tambahan).
 * Tanpa `RESEND_API_KEY`, email dilewati dengan peringatan agar alur pembayaran
 * tidak pernah gagal karena email.
 */
export class EmailService {
  static isConfigured(): boolean {
    return Boolean(config.email.resendApiKey && config.email.from);
  }

  static async send(params: SendEmailParams): Promise<SendEmailResult> {
    if (!this.isConfigured()) {
      if (!config.isProd) {
        console.warn(`[Email] RESEND_API_KEY belum diset — email "${params.subject}" ke ${params.to} dilewati.`);
      }
      return { ok: false, skipped: true };
    }

    const replyTo = params.replyTo || config.email.replyTo;

    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.email.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.email.from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          ...(params.text ? { text: params.text } : {}),
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(`[Email] Resend gagal (${res.status}) untuk ${params.to}: ${detail}`);
        return { ok: false, error: `Resend ${res.status}` };
      }

      const data = (await res.json().catch(() => ({}))) as { id?: string };
      if (!config.isProd) {
        console.log(`[Email] Terkirim ke ${params.to} (id: ${data.id ?? "-"}).`);
      }
      return { ok: true, id: data.id };
    } catch (err: any) {
      console.error(`[Email] Resend error untuk ${params.to}:`, err?.message || err);
      return { ok: false, error: err?.message || "network error" };
    }
  }

  static async sendLicenseIssued(params: {
    to: string;
    appName: string;
    licenseKey: string;
    expiresAt: Date;
    customerName?: string;
    deliveryDetails?: {
      fileDownload?: { title?: string; fileUrl?: string; fileName?: string };
      privateNote?: { title?: string; note?: string };
      apiAccess?: { endpointUrl?: string; instruction?: string };
    };
  }): Promise<SendEmailResult> {
    const appName = escapeHtml(params.appName);
    const licenseKey = escapeHtml(params.licenseKey);
    const greeting = params.customerName ? `Halo ${escapeHtml(params.customerName)},` : "Halo,";
    const expires = formatDate(params.expiresAt);

    let deliverySectionHtml = "";
    const textExtra: string[] = [];

    if (params.deliveryDetails?.fileDownload?.fileUrl) {
      const fileTitle = escapeHtml(params.deliveryDetails.fileDownload.title || "Unduh Berkas Digital");
      const fileUrl = escapeHtml(params.deliveryDetails.fileDownload.fileUrl);
      deliverySectionHtml += `
        <div style="margin:20px 0;padding:16px;background:#0b0b0f;border:1px solid #27272a;border-radius:8px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:bold;text-transform:uppercase;color:#D4AF37;">Akses Berkas / File</p>
          <p style="margin:0 0 10px;font-size:13px;color:#e5e7eb;">${fileTitle}</p>
          <a href="${fileUrl}" style="display:inline-block;padding:8px 16px;background:#D4AF37;color:#111111;text-decoration:none;border-radius:6px;font-weight:bold;font-size:13px;">Unduh Berkas</a>
        </div>`;
      textExtra.push(`Akses Berkas: ${fileTitle} -> ${params.deliveryDetails.fileDownload.fileUrl}`);
    }

    if (params.deliveryDetails?.privateNote?.note) {
      const noteTitle = escapeHtml(params.deliveryDetails.privateNote.title || "Catatan Rahasia / Panduan");
      const noteContent = escapeHtml(params.deliveryDetails.privateNote.note);
      deliverySectionHtml += `
        <div style="margin:20px 0;padding:16px;background:#0b0b0f;border:1px solid #27272a;border-radius:8px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:bold;text-transform:uppercase;color:#a5f3fc;">${noteTitle}</p>
          <p style="margin:0;font-size:13px;color:#d4d4d8;white-space:pre-wrap;">${noteContent}</p>
        </div>`;
      textExtra.push(`Catatan: ${params.deliveryDetails.privateNote.title || "Panduan"} -> ${params.deliveryDetails.privateNote.note}`);
    }

    if (params.deliveryDetails?.apiAccess?.endpointUrl) {
      const apiUrl = escapeHtml(params.deliveryDetails.apiAccess.endpointUrl);
      const apiInstruction = escapeHtml(params.deliveryDetails.apiAccess.instruction || "");
      deliverySectionHtml += `
        <div style="margin:20px 0;padding:16px;background:#0b0b0f;border:1px solid #27272a;border-radius:8px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:bold;text-transform:uppercase;color:#86efac;">Akses API</p>
          <p style="margin:0 0 6px;font-size:13px;font-family:monospace;color:#e5e7eb;">${apiUrl}</p>
          ${apiInstruction ? `<p style="margin:0;font-size:12px;color:#a1a1aa;">${apiInstruction}</p>` : ""}
        </div>`;
      textExtra.push(`Akses API: ${params.deliveryDetails.apiAccess.endpointUrl}`);
    }

    const html = `<!doctype html>
<html lang="id">
  <body style="margin:0;padding:24px;background:#0b0b0f;font-family:Arial,Helvetica,sans-serif;color:#e5e7eb;">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#15151c;border:1px solid #26262f;border-radius:12px;">
      <tr><td style="padding:32px;">
        <h1 style="margin:0 0 8px;font-size:20px;color:#ffffff;">Lisensi ${appName} aktif</h1>
        <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;">${greeting} pembayaran kamu sudah kami terima dan lisensi telah diterbitkan.</p>
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#71717a;">Kunci Lisensi</p>
        <p style="margin:0 0 20px;padding:14px 16px;background:#0b0b0f;border:1px dashed #3f3f46;border-radius:8px;font-family:monospace;font-size:15px;word-break:break-all;color:#a5f3fc;">${licenseKey}</p>
        <table role="presentation" width="100%" style="font-size:13px;color:#a1a1aa;">
          <tr><td style="padding:4px 0;">Produk</td><td style="padding:4px 0;text-align:right;color:#e5e7eb;">${appName}</td></tr>
          <tr><td style="padding:4px 0;">Berlaku sampai</td><td style="padding:4px 0;text-align:right;color:#e5e7eb;">${expires}</td></tr>
        </table>
        ${deliverySectionHtml}
        <p style="margin:20px 0 0;font-size:12px;color:#71717a;">Salin kunci lisensi di atas dan masukkan langsung ke dalam aplikasi ${appName} untuk mengaktifkan.</p>
      </td></tr>
    </table>
  </body>
</html>`;

    const text = [
      `Lisensi ${params.appName} aktif`,
      "",
      greeting,
      "Pembayaran kamu sudah kami terima dan lisensi telah diterbitkan.",
      "",
      `Kunci Lisensi : ${params.licenseKey}`,
      `Produk        : ${params.appName}`,
      `Berlaku s/d   : ${expires}`,
      ...(textExtra.length > 0 ? ["", ...textExtra] : []),
      "",
      `Masukkan kunci lisensi di atas langsung ke aplikasi ${params.appName} untuk mengaktifkan.`,
    ].join("\n");

    return this.send({
      to: params.to,
      subject: `Lisensi ${params.appName} kamu aktif`,
      html,
      text,
    });
  }
}
