/**
 * Modul Server-to-Server (S2S) Admin API.
 * Digunakan oleh backend pengembang dengan Secret Key (`tt_secret_...`).
 */

import { verifyWebhookSignature } from "../utils/crypto";
import type {
  S2SIssueOptions,
  S2SIssueBatchOptions,
  S2SRevokeOptions,
  S2SRevokeBatchOptions,
  S2STransferOptions,
  S2SWebhookCreateOptions,
} from "../types";

export interface S2SExecutor {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  apiKey: string;
  appId?: string;
}

export class S2SModule {
  constructor(private ctx: S2SExecutor) {}

  private authHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.ctx.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private async get(path: string): Promise<any> {
    const res = await this.ctx.request(path, { headers: this.authHeaders() });
    return res.json();
  }

  private async post(path: string, body?: any, method = "POST"): Promise<any> {
    const res = await this.ctx.request(path, {
      method,
      headers: this.authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  /** Ambil profil builder pemilik secret key. */
  public async info(): Promise<any> {
    return this.get("/api/v1/s2s");
  }

  /** Manajemen Aplikasi di bawah builder. */
  public apps = {
    list: async (mode?: "live" | "sandbox"): Promise<any> =>
      this.get(`/api/v1/s2s/apps${mode ? `?mode=${mode}` : ""}`),
    get: async (appId: string): Promise<any> => this.get(`/api/v1/s2s/apps/${appId}`),
  };

  /** Operasi Lisensi Server-to-Server. */
  public licenses = {
    list: async (filter?: {
      appId?: string;
      status?: "ACTIVE" | "REVOKED" | "EXPIRED";
      limit?: number;
    }): Promise<any> => {
      const params = new URLSearchParams();
      if (filter?.appId) params.set("appId", filter.appId);
      if (filter?.status) params.set("status", filter.status);
      if (filter?.limit) params.set("limit", String(filter.limit));
      const q = params.toString() ? `?${params.toString()}` : "";
      return this.get(`/api/v1/s2s/licenses${q}`);
    },

    issue: async (options: S2SIssueOptions): Promise<any> =>
      this.post("/api/v1/s2s/licenses/issue", {
        ...options,
        appId: options.appId || this.ctx.appId,
      }),

    issueBatch: async (options: S2SIssueBatchOptions): Promise<any> =>
      this.post("/api/v1/s2s/licenses/issue-batch", {
        ...options,
        appId: options.appId || this.ctx.appId,
      }),

    revoke: async (options: S2SRevokeOptions): Promise<any> =>
      this.post("/api/v1/s2s/licenses/revoke", options),

    revokeBatch: async (options: S2SRevokeBatchOptions): Promise<any> =>
      this.post("/api/v1/s2s/licenses/revoke-batch", options),

    seats: async (licenseKey: string): Promise<any> =>
      this.get(`/api/v1/s2s/licenses/seats?licenseKey=${encodeURIComponent(licenseKey)}`),

    releaseSeat: async (options: { licenseKey: string; hwid: string }): Promise<any> =>
      this.post("/api/v1/s2s/licenses/seat/release", options),

    recover: async (licenseKey: string): Promise<any> =>
      this.post("/api/v1/s2s/licenses/recover", { licenseKey }),

    transfer: async (options: S2STransferOptions): Promise<any> =>
      this.post("/api/v1/s2s/licenses/transfer", options),

    events: async (filter: {
      licenseKey?: string;
      appId?: string;
      event?: string;
      actorType?: string;
      limit?: number;
    }): Promise<any> => {
      const params = new URLSearchParams();
      if (filter.licenseKey) params.set("licenseKey", filter.licenseKey);
      if (filter.appId) params.set("appId", filter.appId);
      if (filter.event) params.set("event", filter.event);
      if (filter.actorType) params.set("actorType", filter.actorType);
      if (filter.limit) params.set("limit", String(filter.limit));
      return this.get(`/api/v1/s2s/licenses/events?${params.toString()}`);
    },
  };

  /** Operasi Saldo & Kredit S2S. */
  public credits = {
    balance: async (licenseKey: string): Promise<any> =>
      this.get(`/api/v1/s2s/credits/balance?licenseKey=${encodeURIComponent(licenseKey)}`),
    consume: async (options: {
      licenseKey: string;
      amount: number;
      reference?: string;
      reason?: string;
    }): Promise<any> => this.post("/api/v1/s2s/credits/consume", options),
  };

  /** Manajemen Webhooks Lifecycle S2S. */
  public webhooks = {
    list: async (): Promise<any> => this.get("/api/v1/s2s/webhooks"),
    create: async (options: S2SWebhookCreateOptions): Promise<any> =>
      this.post("/api/v1/s2s/webhooks", options),
    update: async (id: string, patch: Partial<S2SWebhookCreateOptions>): Promise<any> =>
      this.post(`/api/v1/s2s/webhooks/${id}`, patch, "PATCH"),
    delete: async (id: string): Promise<any> =>
      this.post(`/api/v1/s2s/webhooks/${id}`, undefined, "DELETE"),
    rotateSecret: async (id: string): Promise<any> =>
      this.post(`/api/v1/s2s/webhooks/${id}/rotate-secret`),
    test: async (id: string): Promise<any> => this.post(`/api/v1/s2s/webhooks/${id}/test`),
    verifySignature: (rawBody: string, signature: string, secret: string): Promise<boolean> =>
      verifyWebhookSignature(rawBody, signature, secret),
  };
}
