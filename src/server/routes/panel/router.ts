import { Elysia, t } from "elysia";
import { authenticate } from "../../middleware/auth";
import { handlePanelStats } from "./stats";
import { handlePanelBuilders } from "./builders";
import { handlePanelTransactions } from "./transactions";
import { handleBatchPayout } from "./payouts";

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
      description: "Returns all registered builders, their apps count, bank disbursement accounts, and earnings",
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
  });
