import { Elysia, t } from "elysia";
import { authenticate } from "../../middleware/auth";
import { handlePanelStats } from "./stats";
import { handlePanelBuilders } from "./builders";
import { handlePanelApps } from "./apps";
import { handlePanelLicenses, handleRevokeLicense, handleReactivateLicense } from "./licenses";
import {
  handlePanelCoupons,
  handleCreateGlobalCoupon,
  handleToggleCoupon,
  handleDeleteCoupon,
} from "./coupons";
import { handlePanelAuditLogs } from "./audit";
import { handlePanelUsers, handleUpdateUserRole, handleToggleUserBan } from "./users";
import { handlePanelTransactions } from "./transactions";
import { handleBatchPayout } from "./payouts";
import { handleRefundTransaction } from "./refund";
import { handleToggleSuspendBuilder, handleToggleSuspendApp } from "./moderation";
import {
  handleExportTransactions,
  handleExportBuilders,
  handleExportApps,
  handleExportLicenses,
} from "./export";
import {
  handleGetPlatformSettings,
  handleUpdatePlatformSettings,
  handleSyncPaymentChannels,
} from "./settings";

export const panelRoutes = new Elysia({ prefix: "/panel" })
  .onBeforeHandle(async ({ request: { headers }, status }) => {
    const res = await authenticate(headers, true);
    if ("status" in res) return status(res.status, { error: res.error });
  })
  /**
   * Macro Platform Overview Stats (Pendapatan Fee 5% & GMV Platform tertaut.com)
   */
  .get("/stats", handlePanelStats, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Platform Macro Overview",
      description: "Returns aggregated platform metrics, MoR 5% fee revenue, and system telemetry",
    },
  })

  /**
   * Direktori Builder & Rekening Pencairan
   */
  .get("/builders", handlePanelBuilders, {
    detail: {
      tags: ["Admin Panel"],
      summary: "List Builders & Bank Accounts",
      description:
        "Returns all registered builders, their apps count, bank disbursement accounts, and earnings",
    },
  })

  /**
   * Direktori Semua Software / Aplikasi
   */
  .get("/apps", handlePanelApps, {
    query: t.Object({
      limit: t.Optional(t.Numeric({ default: 100 })),
      mode: t.Optional(t.String()),
      status: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Admin Panel"],
      summary: "List All Software / Applications",
    },
  })

  /**
   * Manajemen Lisensi Global
   */
  .get("/licenses", handlePanelLicenses, {
    query: t.Object({
      limit: t.Optional(t.Numeric({ default: 100 })),
      status: t.Optional(t.String()),
      search: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Admin Panel"],
      summary: "List All Software Licenses",
    },
  })
  .post("/licenses/:id/revoke", handleRevokeLicense, {
    body: t.Optional(
      t.Object({
        reason: t.Optional(t.String()),
      })
    ),
    detail: {
      tags: ["Admin Panel"],
      summary: "Revoke Software License",
    },
  })
  .post("/licenses/:id/reactivate", handleReactivateLicense, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Reactivate Revoked License",
    },
  })

  /**
   * Kupon Diskon Global & Platform
   */
  .get("/coupons", handlePanelCoupons, {
    detail: {
      tags: ["Admin Panel"],
      summary: "List All Discount Coupons",
    },
  })
  .post("/coupons", handleCreateGlobalCoupon, {
    body: t.Object({
      code: t.String(),
      discountPercent: t.Numeric(),
      maxRedemptions: t.Optional(t.Numeric()),
      expiresAt: t.Optional(t.String()),
      appId: t.Optional(t.Nullable(t.String())),
    }),
    detail: {
      tags: ["Admin Panel"],
      summary: "Create Global Platform Discount Coupon",
    },
  })
  .patch("/coupons/:id/toggle", handleToggleCoupon, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Toggle Coupon Active State",
    },
  })
  .delete("/coupons/:id", handleDeleteCoupon, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Delete Discount Coupon",
    },
  })

  /**
   * Audit Trail & System Event Logs
   */
  .get("/audit-logs", handlePanelAuditLogs, {
    query: t.Object({
      limit: t.Optional(t.Numeric({ default: 100 })),
      actorType: t.Optional(t.String()),
      event: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Admin Panel"],
      summary: "Platform Security & Operations Audit Logs",
    },
  })

  /**
   * Manajemen Pengguna & Hak Akses
   */
  .get("/users", handlePanelUsers, {
    query: t.Object({
      limit: t.Optional(t.Numeric({ default: 100 })),
    }),
    detail: {
      tags: ["Admin Panel"],
      summary: "List All Registered Platform Users",
    },
  })
  .post("/users/:userId/role", handleUpdateUserRole, {
    body: t.Object({
      role: t.String(),
    }),
    detail: {
      tags: ["Admin Panel"],
      summary: "Update User Role (Admin / Builder / User)",
    },
  })
  .post("/users/:userId/toggle-ban", handleToggleUserBan, {
    body: t.Optional(
      t.Object({
        reason: t.Optional(t.String()),
      })
    ),
    detail: {
      tags: ["Admin Panel"],
      summary: "Toggle Ban / Unban User Account",
    },
  })

  /**
   * Ledger Transaksi Global (Audit Cross-Builder)
   */
  .get("/transactions", handlePanelTransactions, {
    query: t.Object({
      limit: t.Optional(t.Numeric({ default: 100 })),
      status: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Admin Panel"],
      summary: "Global Transactions Audit Ledger",
    },
  })

  /**
   * Eksekusi Batch Payout Massal ke Seluruh Builder
   */
  .post("/payouts/batch", handleBatchPayout, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Execute Batch Payouts to Builders",
    },
  })

  /**
   * Refund Transaksi & Auto-Revoke Lisensi
   */
  .post("/transactions/:txId/refund", handleRefundTransaction, {
    body: t.Optional(
      t.Object({
        reason: t.Optional(t.String()),
      })
    ),
    detail: {
      tags: ["Admin Panel"],
      summary: "Refund Transaction & Revoke License",
    },
  })

  /**
   * Moderasi: Suspend / Unsuspend Builder
   */
  .post("/builders/:builderId/toggle-suspend", handleToggleSuspendBuilder, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Toggle Suspend Status for Builder",
    },
  })

  /**
   * Moderasi: Suspend / Unsuspend App
   */
  .post("/apps/:appId/toggle-suspend", handleToggleSuspendApp, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Toggle Suspend Status for App",
    },
  })

  /**
   * Ekspor CSV: Ledger Transaksi
   */
  .get("/export/transactions", handleExportTransactions, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Export Transactions Ledger to CSV",
    },
  })

  /**
   * Ekspor CSV: Direktori Builder
   */
  .get("/export/builders", handleExportBuilders, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Export Builders Directory to CSV",
    },
  })

  /**
   * Ekspor CSV: Direktori Software
   */
  .get("/export/apps", handleExportApps, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Export Apps Directory to CSV",
    },
  })

  /**
   * Ekspor CSV: Daftar Lisensi
   */
  .get("/export/licenses", handleExportLicenses, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Export Licenses to CSV",
    },
  })

  /**
   * Pengaturan Platform: Baca Pengaturan
   */
  .get("/settings", handleGetPlatformSettings, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Get Platform Configuration & Settings",
    },
  })

  /**
   * Pengaturan Platform: Perbarui Pengaturan (PUT & PATCH)
   */
  .put("/settings", handleUpdatePlatformSettings, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Update Platform Configuration & Settings",
    },
  })
  .patch("/settings", handleUpdatePlatformSettings, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Update Platform Configuration & Settings (Patch)",
    },
  })
  /**
   * Pengaturan Platform: Sinkronisasi & Tes Real-time Channel Gateway
   */
  .post("/settings/sync-channels", handleSyncPaymentChannels, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Sync & Test Payment Gateway Channels Real-time",
    },
  });
