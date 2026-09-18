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

  /** Ambil profil builder pemilik secret key. */
  public async info(): Promise<any> {
    const res = await this.ctx.request("/api/v1/s2s", {
      headers: { Authorization: `Bearer ${this.ctx.apiKey}` },
    });
    return res.json();
  }

  /** Manajemen Aplikasi di bawah builder. */
  public apps = {
    list: async (mode?: "live" | "sandbox"): Promise<any> => {
      const query = mode ? `?mode=${mode}` : "";
      const res = await this.ctx.request(`/api/v1/s2s/apps${query}`, {
        headers: { Authorization: `Bearer ${this.ctx.apiKey}` },
      });
      return res.json();
    },
    get: async (appId: string): Promise<any> => {
      const res = await this.ctx.request(`/api/v1/s2s/apps/${appId}`, {
        headers: { Authorization: `Bearer ${this.ctx.apiKey}` },
      });
      return res.json();
    },
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
      const res = await this.ctx.request(`/api/v1/s2s/licenses${q}`, {
        headers: { Authorization: `Bearer ${this.ctx.apiKey}` },
      });
      return res.json();
    },

    issue: async (options: S2SIssueOptions): Promise<any> => {
      const targetAppId = options.appId || this.ctx.appId;
      const res = await this.ctx.request("/api/v1/s2s/licenses/issue", {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify({ ...options, appId: targetAppId }),
      });
      return res.json();
    },

    issueBatch: async (options: S2SIssueBatchOptions): Promise<any> => {
      const targetAppId = options.appId || this.ctx.appId;
      const res = await this.ctx.request("/api/v1/s2s/licenses/issue-batch", {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify({ ...options, appId: targetAppId }),
      });
      return res.json();
    },

    revoke: async (options: S2SRevokeOptions): Promise<any> => {
      const res = await this.ctx.request("/api/v1/s2s/licenses/revoke", {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify(options),
      });
      return res.json();
    },

    revokeBatch: async (options: S2SRevokeBatchOptions): Promise<any> => {
      const res = await this.ctx.request("/api/v1/s2s/licenses/revoke-batch", {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify(options),
      });
      return res.json();
    },

    seats: async (licenseKey: string): Promise<any> => {
      const res = await this.ctx.request(
        `/api/v1/s2s/licenses/seats?licenseKey=${encodeURIComponent(licenseKey)}`,
        { headers: { Authorization: `Bearer ${this.ctx.apiKey}` } }
      );
      return res.json();
    },

    releaseSeat: async (options: { licenseKey: string; hwid: string }): Promise<any> => {
      const res = await this.ctx.request("/api/v1/s2s/licenses/seat/release", {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify(options),
      });
      return res.json();
    },

    recover: async (licenseKey: string): Promise<any> => {
      const res = await this.ctx.request("/api/v1/s2s/licenses/recover", {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify({ licenseKey }),
      });
      return res.json();
    },

    transfer: async (options: S2STransferOptions): Promise<any> => {
      const res = await this.ctx.request("/api/v1/s2s/licenses/transfer", {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify(options),
      });
      return res.json();
    },

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
      const res = await this.ctx.request(`/api/v1/s2s/licenses/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${this.ctx.apiKey}` },
      });
      return res.json();
    },
  };

  /** Operasi Saldo & Kredit S2S. */
  public credits = {
    balance: async (licenseKey: string): Promise<any> => {
      const res = await this.ctx.request(
        `/api/v1/s2s/credits/balance?licenseKey=${encodeURIComponent(licenseKey)}`,
        { headers: { Authorization: `Bearer ${this.ctx.apiKey}` } }
      );
      return res.json();
    },
    consume: async (options: {
      licenseKey: string;
      amount: number;
      reference?: string;
      reason?: string;
    }): Promise<any> => {
      const res = await this.ctx.request("/api/v1/s2s/credits/consume", {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify(options),
      });
      return res.json();
    },
  };

  /** Manajemen Webhooks Lifecycle S2S. */
  public webhooks = {
    list: async (): Promise<any> => {
      const res = await this.ctx.request("/api/v1/s2s/webhooks", {
        headers: { Authorization: `Bearer ${this.ctx.apiKey}` },
      });
      return res.json();
    },
    create: async (options: S2SWebhookCreateOptions): Promise<any> => {
      const res = await this.ctx.request("/api/v1/s2s/webhooks", {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify(options),
      });
      return res.json();
    },
    update: async (id: string, patch: Partial<S2SWebhookCreateOptions>): Promise<any> => {
      const res = await this.ctx.request(`/api/v1/s2s/webhooks/${id}`, {
        method: "PATCH",
        headers: this.authHeaders(),
        body: JSON.stringify(patch),
      });
      return res.json();
    },
    delete: async (id: string): Promise<any> => {
      const res = await this.ctx.request(`/api/v1/s2s/webhooks/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.ctx.apiKey}` },
      });
      return res.json();
    },
    rotateSecret: async (id: string): Promise<any> => {
      const res = await this.ctx.request(`/api/v1/s2s/webhooks/${id}/rotate-secret`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.ctx.apiKey}` },
      });
      return res.json();
    },
    test: async (id: string): Promise<any> => {
      const res = await this.ctx.request(`/api/v1/s2s/webhooks/${id}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.ctx.apiKey}` },
      });
      return res.json();
    },
    verifySignature: (rawBody: string, signature: string, secret: string): Promise<boolean> => {
      return verifyWebhookSignature(rawBody, signature, secret);
    },
  };
}
