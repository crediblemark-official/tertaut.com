import { Elysia, t } from "elysia";
import { authenticate } from "../../middleware/auth";
import { handlePanelStats } from "./stats";
import { handlePanelBuilders } from "./builders";
import { handlePanelTransactions } from "./transactions";
import { handleBatchPayout } from "./payouts";
import { handleRefundTransaction } from "./refund";
import { handleToggleSuspendBuilder, handleToggleSuspendApp } from "./moderation";
import { handleExportTransactions, handleExportBuilders } from "./export";
import { handleGetPlatformSettings, handleUpdatePlatformSettings } from "./settings";

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
   * Pengaturan Platform: Baca Pengaturan
   */
  .get("/settings", handleGetPlatformSettings, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Get Platform Configuration & Settings",
    },
  })

  /**
   * Pengaturan Platform: Perbarui Pengaturan
   */
  .put("/settings", handleUpdatePlatformSettings, {
    detail: {
      tags: ["Admin Panel"],
      summary: "Update Platform Configuration & Settings",
    },
  });
