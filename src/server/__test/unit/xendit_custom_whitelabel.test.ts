import { describe, it, expect, spyOn } from "bun:test";
import { xenditGateway } from "../../services/payments/gateways/xenditGateway";
import { handleGetInvoiceData, handleGetPaymentStatus } from "../../routes/checkout/handlers";
import { handleCreateSession } from "../../routes/checkout/session";
import { handleXenditInvoiceWebhook } from "../../routes/webhook/xendit";
import { handleGetBySlug } from "../../routes/apps/queries";
import { handleCreateApp, handleUpdateApp } from "../../routes/apps/mutations";
import { handleSimulateSandboxPayment } from "../../routes/sandbox/simulatePayment";
import { handleCreateWebhook, handleUpdateWebhook } from "../../routes/licensing/adminWebhooks";
import { handleListEvents } from "../../routes/licensing/admin";
import {
  handleRevokeLicense as handlePanelRevokeLicense,
  handleReactivateLicense as handlePanelReactivateLicense,
} from "../../routes/panel/licenses";
import { fulfillPaymentTransaction } from "../../routes/webhook/fulfill";
import { expirePendingTransactions } from "../../tasks/scheduler";
import { EmailService } from "../../services/notifications/email";
import { LicenseTokenService } from "../../services/licensing/licenseToken";
import { LicenseService } from "../../services/licensing/license";
import * as builderModule from "../../routes/apps/builder";
import { auth } from "../../auth";
import { handleBatchPayout } from "../../routes/panel/payouts";
import { handlePanelStats } from "../../routes/panel/stats";
import { handleSyncPaymentChannels } from "../../routes/panel/settings";
import { resolveAppGrantDays, resolvePublicPaymentRailInfo } from "../../utils/payment";
import { app as elysiaApp } from "../../index";
import { db } from "../../db";
import {
  apps,
  builders,
  transactions,
  licenses,
  platformSettings,
  webhookEndpoints,
  coupons,
  revokedTokens,
} from "../../db/schema";
import { eq } from "drizzle-orm";
import { createPollTicket } from "../../utils/pollTicket";
import { setupTestAuth, authCookie } from "../setup";
import { randomBytes } from "crypto";

describe("White-Label Full Custom UI & Xendit PaymentRequest v2", () => {
  setupTestAuth();

  it("rejects raw card rail in scenario API while cardEnabled is false", async () => {
    const spyClient = spyOn(xenditGateway as any, "getClient").mockResolvedValue({
      PaymentRequest: { createPaymentRequest: async () => ({}) },
    });
    await expect(
      xenditGateway.createOrder({
        externalId: `tt_card_${Date.now()}`,
        amount: 50000,
        payerEmail: "buyer@example.invalid",
        description: "Test Card",
        scenario: "API",
        paymentRail: "card",
      })
    ).rejects.toThrow("belum tersedia");
    spyClient.mockRestore();
  });

  it("uses PaymentRequest API v2 for QRIS, VA (BSS->SAHABAT_SAMPOERNA), Retail, and E-Wallet", async () => {
    const calls: any[] = [];
    const spyClient = spyOn(xenditGateway as any, "getClient").mockResolvedValue({
      PaymentRequest: {
        createPaymentRequest: async ({ data }: any) => {
          calls.push(data);
          const type = data.paymentMethod.type;
          if (type === "QR_CODE") {
            return {
              id: "pr-qris-1",
              paymentMethod: {
                type,
                qrCode: { channelProperties: { qrString: "000201010212..." } },
              },
            };
          }
          if (type === "VIRTUAL_ACCOUNT") {
            return {
              id: "pr-va-1",
              paymentMethod: {
                type,
                virtualAccount: { channelProperties: { virtualAccountNumber: "8890812345" } },
              },
            };
          }
          if (type === "OVER_THE_COUNTER") {
            return {
              id: "pr-otc-1",
              paymentMethod: {
                type,
                overTheCounter: { channelProperties: { paymentCode: "ALFA123456" } },
              },
            };
          }
          return {
            id: "pr-ew-1",
            actions: [{ action: "AUTH", urlType: "WEB", url: "https://wallet.example/pay" }],
            paymentMethod: { type },
          };
        },
        getPaymentRequestByID: async ({ paymentRequestId }: any) => ({
          id: paymentRequestId,
          status: "SUCCEEDED",
          amount: 50000,
          paymentMethod: {
            type: "OVER_THE_COUNTER",
            overTheCounter: { channelCode: "ALFAMART" },
          },
        }),
      },
    });

    const qris = await xenditGateway.createOrder({
      externalId: "tt_qris_1",
      amount: 50000,
      payerEmail: "buyer@example.invalid",
      description: "QRIS",
      scenario: "API",
      paymentRail: "qris",
    });
    expect(qris.orderId).toBe("pr-qris-1");
    expect(qris.qrDataUrl).toStartWith("data:image/png;base64,");
    expect(qris.checkoutUrl).toBe("");

    const va = await xenditGateway.createOrder({
      externalId: "tt_va_1",
      amount: 50000,
      payerEmail: "buyer@example.invalid",
      description: "VA",
      scenario: "API",
      paymentRail: "va",
      vaBank: "BSS",
    });
    expect(va.orderId).toBe("pr-va-1");
    expect(va.paymentCode).toBe("8890812345");
    expect(calls[1].paymentMethod.virtualAccount.channelCode).toBe("SAHABAT_SAMPOERNA");

    const retail = await xenditGateway.createOrder({
      externalId: "tt_ret_1",
      amount: 50000,
      payerEmail: "buyer@example.invalid",
      description: "Retail",
      scenario: "API",
      paymentRail: "retail",
      retailOutlet: "ALFAMART",
    });
    expect(retail.orderId).toBe("pr-otc-1");
    expect(retail.paymentCode).toBe("ALFA123456");

    await expect(
      xenditGateway.createOrder({
        externalId: "tt_ovo_bad",
        amount: 50000,
        payerEmail: "buyer@example.invalid",
        description: "OVO",
        scenario: "API",
        paymentRail: "ewallet",
        ewalletChannel: "OVO",
      })
    ).rejects.toThrow("Nomor HP OVO");

    const ovo = await xenditGateway.createOrder({
      externalId: "tt_ovo_ok",
      amount: 50000,
      payerEmail: "buyer@example.invalid",
      description: "OVO",
      scenario: "API",
      paymentRail: "ewallet",
      ewalletChannel: "OVO",
      ewalletPhone: "081234567890",
    });
    expect(ovo.orderId).toBe("pr-ew-1");
    expect(calls[3].paymentMethod.ewallet.channelProperties.mobileNumber).toBe("+6281234567890");

    const astra = await xenditGateway.createOrder({
      externalId: "tt_astra_1",
      amount: 50000,
      payerEmail: "buyer@example.invalid",
      description: "AstraPay",
      scenario: "API",
      paymentRail: "ewallet",
      ewalletChannel: "ASTRAPAY",
    });
    expect(astra.actionUrl).toBe("https://wallet.example/pay");

    const status = await xenditGateway.queryOrderStatus({
      externalId: "tt_ret_1",
      referenceNo: "pr-otc-1",
    });
    expect(status.isPaid).toBe(true);
    expect(status.paymentChannel).toBe("ALFAMART");

    spyClient.mockRestore();
  });

  it("sanitizes invoice channels, resolves by xenditExternalId, and handles legacy FVA callback", async () => {
    const suffix = randomBytes(4).toString("hex");
    const [builder] = await db
      .insert(builders)
      .values({
        name: "WL Builder",
        email: `wl_${suffix}@example.invalid`,
        apiKey: `key_${suffix}`,
      })
      .returning();

    const appId = `app_wl_${suffix}`;
    await db.insert(apps).values({
      id: appId,
      slug: appId,
      builderId: builder.id,
      name: "WhiteLabel App",
      mode: "live",
      targetPrice: 50000,
      redirectUrl: "https://app.example.invalid/welcome",
      deliveryConfig: {
        licenseKey: { enabled: true, expiresInDays: 30 },
        privateNote: { enabled: true, title: "Catatan", note: "Halo pembeli" },
      },
    });

    const txId = `tx_wl_${suffix}`;
    const extId = `tt_wl_${suffix}`;
    await db.insert(transactions).values({
      id: txId,
      appId,
      builderId: builder.id,
      mode: "live",
      paymentProvider: "xendit",
      providerReferenceId: `pr-${suffix}`,
      xenditInvoiceId: `pr-${suffix}`,
      xenditExternalId: extId,
      customerEmail: "buyer@example.invalid",
      grossAmount: 50000,
      platformFee: 2500,
      netAmount: 47500,
      paymentChannel: "XENDIT_QRIS",
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
      grantDays: 30,
    });

    // Legacy FVA callback without explicit status field should still fulfill when callback_virtual_account_id + payment_id + amount match
    const verifySpy = spyOn(xenditGateway, "verifyWebhook").mockResolvedValue(true);
    const whRes = await handleXenditInvoiceWebhook({
      request: new Request("http://localhost:8081/api/v1/webhook/xendit", { method: "POST" }),
      headers: { "x-callback-token": "ok" },
      body: {
        external_id: extId,
        callback_virtual_account_id: "va_123",
        payment_id: "pay_123",
        bank_code: "MANDIRI",
        amount: 50000,
      },
      set: {},
    });
    expect(whRes.success).toBe(true);
    verifySpy.mockRestore();

    const ticket = createPollTicket(txId);
    const invRes: any = await handleGetInvoiceData({
      params: { txId: extId },
      query: { ticket },
      request: new Request("http://localhost:8081"),
      set: {},
    });
    expect(invRes.success).toBe(true);
    expect(invRes.invoice.payment.provider).toBe("TERTAUT PAY");
    expect(invRes.invoice.payment.channel).not.toContain("XENDIT");
    expect(invRes.invoice.delivery.privateNote.note).toBe("Halo pembeli");
    expect(invRes.invoice.delivery.redirectUrl).toBe("https://app.example.invalid/welcome");

    // Public checkout errors must not leak Xendit dashboard URLs or key names
    const orderSpy = spyOn(xenditGateway, "createOrder").mockRejectedValueOnce(
      new Error("UNAUTHORIZED_SENDER_IP: IP 1.2.3.4 not in IP Allowlist")
    );
    const setObj: any = {};
    const errRes: any = await handleCreateSession({
      request: new Request("http://localhost:8081/api/v1/checkout/session", { method: "POST" }),
      body: { appId, customerEmail: "buyer@example.invalid", paymentRail: "qris" },
      set: setObj,
    });
    expect(errRes.success).toBe(false);
    expect(errRes.error).not.toContain("Xendit");
    expect(errRes.error).not.toContain("dashboard.xendit.co");
    orderSpy.mockRestore();

    await db.delete(licenses).where(eq(licenses.appId, appId));
    await db.delete(transactions).where(eq(transactions.appId, appId));
    await db.delete(apps).where(eq(apps.id, appId));
    await db.delete(builders).where(eq(builders.id, builder.id));
  });

  it("never resolves production Xendit secret key when NODE_ENV is not production", async () => {
    const prevProdKey = process.env.XENDIT_PRODUCTION_SECRET_KEY;
    const prevSandboxKey = process.env.XENDIT_SANDBOX_SECRET_KEY;
    const prevAllow = process.env.ALLOW_PROD_KEYS_IN_DEV;
    process.env.XENDIT_PRODUCTION_SECRET_KEY = "xnd_production_fake_guardrail_test";
    process.env.XENDIT_SANDBOX_SECRET_KEY = "xnd_development_fake_guardrail_test";
    delete process.env.ALLOW_PROD_KEYS_IN_DEV;

    const existingSandbox = await db.query.platformSettings.findFirst({
      where: eq(platformSettings.key, "sandbox_mode"),
    });
    const existingToken = await db.query.platformSettings.findFirst({
      where: eq(platformSettings.key, "xendit_webhook_token"),
    });
    // Simulate sandbox_mode=false in DB and empty webhook token so config.isTest shortcut is bypassed
    await db
      .insert(platformSettings)
      .values({ key: "sandbox_mode", value: "false", updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: "false", updatedAt: new Date() },
      });
    await db
      .insert(platformSettings)
      .values({ key: "xendit_webhook_token", value: "", updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: "", updatedAt: new Date() },
      });

    const creds = await xenditGateway.getCredentials();
    expect(creds.secretKey).toBe("xnd_development_fake_guardrail_test");
    expect(creds.secretKey.startsWith("xnd_production_")).toBe(false);

    if (existingSandbox) {
      await db
        .update(platformSettings)
        .set({ value: existingSandbox.value })
        .where(eq(platformSettings.key, "sandbox_mode"));
    }
    if (existingToken) {
      await db
        .update(platformSettings)
        .set({ value: existingToken.value })
        .where(eq(platformSettings.key, "xendit_webhook_token"));
    }
    if (prevProdKey === undefined) delete process.env.XENDIT_PRODUCTION_SECRET_KEY;
    else process.env.XENDIT_PRODUCTION_SECRET_KEY = prevProdKey;
    if (prevSandboxKey === undefined) delete process.env.XENDIT_SANDBOX_SECRET_KEY;
    else process.env.XENDIT_SANDBOX_SECRET_KEY = prevSandboxKey;
    if (prevAllow !== undefined) process.env.ALLOW_PROD_KEYS_IN_DEV = prevAllow;
  });

  it("resolves grantDays from subscription billingPeriod and supports free product claim + delivery status", async () => {
    expect(
      resolveAppGrantDays({
        pricingType: "subscription",
        billingPeriod: "monthly",
        deliveryConfig: { licenseKey: { expiresInDays: 365 } },
      })
    ).toBe(30);
    expect(
      resolveAppGrantDays({
        pricingType: "subscription",
        billingPeriod: "custom_14",
        deliveryConfig: { licenseKey: { expiresInDays: 365 } },
      })
    ).toBe(14);
    expect(
      resolveAppGrantDays({
        pricingType: "subscription",
        billingPeriod: "weekly",
        deliveryConfig: { licenseKey: { expiresInDays: 45 } },
      })
    ).toBe(45);

    const suffix = randomBytes(4).toString("hex");
    const [builder] = await db
      .insert(builders)
      .values({
        name: "Free Builder",
        email: `free_${suffix}@example.invalid`,
        apiKey: `key_free_${suffix}`,
      })
      .returning();

    const freeAppId = `app_free_${suffix}`;
    await db.insert(apps).values({
      id: freeAppId,
      slug: freeAppId,
      builderId: builder.id,
      name: "Free Tool",
      mode: "live",
      appType: "desktop_onprem",
      pricingType: "free",
      targetPrice: 0,
      trialPeriodDays: 0,
      redirectUrl: "https://free.example.invalid/app",
      deliveryConfig: {
        licenseKey: { enabled: true, expiresInDays: 90, maxSeats: 2 },
        fileDownload: {
          enabled: true,
          title: "Download ZIP",
          fileUrl: "https://cdn.example.invalid/app.zip",
        },
        privateNote: { enabled: true, title: "Setup", note: "Readme" },
      },
    });

    const slugRes: any = await handleGetBySlug({ params: { slug: freeAppId }, set: {} });
    expect(slugRes.pricingType).toBe("free");
    expect(slugRes.licenseKeyEnabled).toBe(true);
    expect(slugRes.deliveryConfig).toBeUndefined();

    const claimRes: any = await handleCreateSession({
      request: new Request("http://localhost:8081/api/v1/checkout/session", { method: "POST" }),
      body: { appId: freeAppId, customerEmail: "claimer@example.invalid" },
      set: {},
    });
    expect(claimRes.success).toBe(true);
    expect(claimRes.isFree).toBe(true);
    expect(claimRes.licenseKey).toMatch(/^TT-/);
    expect(claimRes.delivery.fileDownload.fileUrl).toBe("https://cdn.example.invalid/app.zip");
    expect(claimRes.delivery.privateNote.note).toBe("Readme");

    const statusRes: any = await handleGetPaymentStatus({
      params: { txId: claimRes.transactionId },
      query: { ticket: claimRes.ticket },
      request: new Request("http://localhost:8081"),
      set: {},
    });
    expect(statusRes.paymentStatus).toBe("PAID");
    expect(statusRes.delivery.fileDownload.fileUrl).toBe("https://cdn.example.invalid/app.zip");

    await db.delete(licenses).where(eq(licenses.appId, freeAppId));
    await db.delete(transactions).where(eq(transactions.appId, freeAppId));
    await db.delete(apps).where(eq(apps.id, freeAppId));
    await db.delete(builders).where(eq(builders.id, builder.id));
  });

  it("validates e-wallet payout account format, counts PROCESSING batch payouts, and reports real DB telemetry", async () => {
    const badRes = await elysiaApp.handle(
      new Request("http://localhost:8081/api/v1/payouts/account", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: authCookie },
        body: JSON.stringify({
          bankCode: "DANA",
          accountNumber: "12345",
          accountHolderName: "Tester",
        }),
      })
    );
    expect(badRes.status).toBe(400);

    const goodRes = await elysiaApp.handle(
      new Request("http://localhost:8081/api/v1/payouts/account", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: authCookie },
        body: JSON.stringify({
          bankCode: "DANA",
          accountNumber: "081234567890",
          accountHolderName: "Tester",
        }),
      })
    );
    expect(goodRes.status).toBe(200);
    const goodJson: any = await goodRes.json();
    expect(goodJson.disbursementAccount.accountNumber).toBe("6281234567890");

    const stats: any = await handlePanelStats();
    expect(stats.system.dbConnected).toBe(true);
    expect(stats.system.dbPort).toBeDefined();

    const sync: any = await handleSyncPaymentChannels();
    expect(sync.success).toBe(true);
    expect(sync.qrisProbe.status).toBeDefined();

    const suffix = randomBytes(4).toString("hex");
    const [b] = await db
      .insert(builders)
      .values({
        name: "Batch Builder",
        email: `batch_${suffix}@example.invalid`,
        apiKey: `key_batch_${suffix}`,
        disbursementAccount: {
          bankCode: "MANDIRI",
          accountNumber: "1234567890",
          accountHolderName: "Batch Builder",
        },
      })
      .returning();
    const appId = `app_batch_${suffix}`;
    await db.insert(apps).values({
      id: appId,
      slug: appId,
      builderId: b.id,
      name: "Batch App",
      mode: "live",
      targetPrice: 100000,
    });
    const txId = `tx_batch_${suffix}`;
    await db.insert(transactions).values({
      id: txId,
      appId,
      builderId: b.id,
      mode: "live",
      paymentProvider: "xendit",
      xenditExternalId: `ext_batch_${suffix}`,
      customerEmail: "buyer@example.invalid",
      grossAmount: 100000,
      platformFee: 5000,
      netAmount: 95000,
      paymentStatus: "PAID",
      disbursementStatus: "PENDING",
    });

    const disbSpy = spyOn(xenditGateway, "createDisbursement").mockResolvedValue({
      id: `disb_${suffix}`,
      externalId: `ext_${suffix}`,
      amount: 95000,
      bankCode: "MANDIRI",
      accountHolderName: "Batch Builder",
      status: "ACCEPTED",
    });
    const batchRes: any = await handleBatchPayout();
    expect(batchRes.processedCount).toBeGreaterThanOrEqual(1);
    expect(batchRes.totalDisbursed).toBeGreaterThanOrEqual(95000);
    disbSpy.mockRestore();

    await db.delete(transactions).where(eq(transactions.appId, appId));
    await db.delete(apps).where(eq(apps.id, appId));
    await db.delete(builders).where(eq(builders.id, b.id));
  });

  it("supports app.id lookup in handleGetBySlug, restores retail/ewallet rails on status polling, handles trial delivery/ticket, and transitions FAILED/CANCELED/payment_request.expiry", async () => {
    // 1. resolvePublicPaymentRailInfo handles QRIS, VA, Retail, E-Wallet
    expect(resolvePublicPaymentRailInfo("QRIS")).toEqual({ paymentRail: "qris" });
    expect(resolvePublicPaymentRailInfo("VA_MANDIRI")).toEqual({
      paymentRail: "va",
      vaBank: "MANDIRI",
    });
    expect(resolvePublicPaymentRailInfo("ALFAMART")).toEqual({
      paymentRail: "retail",
      retailOutlet: "ALFAMART",
    });
    expect(
      resolvePublicPaymentRailInfo("OVO", "https://ewallet.example.invalid/approve/123")
    ).toEqual({
      paymentRail: "ewallet",
      ewalletChannel: "OVO",
      actionUrl: "https://ewallet.example.invalid/approve/123",
    });

    const suffix = randomBytes(4).toString("hex");
    const [b] = await db
      .insert(builders)
      .values({
        name: "PayLink Builder",
        email: `paylink_${suffix}@example.invalid`,
        apiKey: `key_paylink_${suffix}`,
      })
      .returning();

    const appId = `app_pl_${suffix}`;
    const appSlug = `slug-pl-${suffix}`;
    await db.insert(apps).values({
      id: appId,
      slug: appSlug,
      builderId: b.id,
      name: "PayLink App",
      mode: "live",
      targetPrice: 65000,
      trialPeriodDays: 7,
      deliveryConfig: {
        licenseKey: { enabled: false, expiresInDays: 30, maxSeats: 1 },
        privateNote: { enabled: true, title: "Akses Trial", note: "Login ke portal" },
        fileDownload: { enabled: false, title: "Disabled File", fileUrl: "https://x.invalid/f" },
      },
    });

    // 2. handleGetBySlug supports app.id as fallback (used by /pay/:appId links)
    const byIdRes: any = await handleGetBySlug({ params: { slug: appId }, set: {} });
    expect(byIdRes.id).toBe(appId);
    expect(byIdRes.slug).toBe(appSlug);

    // 3. Free trial respects licenseKey.enabled === false and returns ticket + delivery + invoice redirectUrl
    const trialRes: any = await handleCreateSession({
      request: new Request("https://tertaut.com/api/v1/checkout/session", { method: "POST" }),
      body: { appId, customerEmail: `trial_${suffix}@example.invalid`, startTrial: true },
      set: {},
    });
    expect(trialRes.success).toBe(true);
    expect(trialRes.isTrial).toBe(true);
    expect(trialRes.licenseKey).toBeNull();
    expect(typeof trialRes.ticket).toBe("string");
    expect(trialRes.delivery?.licenseKeyEnabled).toBe(false);
    expect(trialRes.delivery?.privateNote?.note).toBe("Login ke portal");
    expect(trialRes.delivery?.fileDownload).toBeUndefined();
    expect(trialRes.redirectUrl).toContain(`externalId=${trialRes.transactionId}`);
    expect(trialRes.redirectUrl).toContain(`ticket=${encodeURIComponent(trialRes.ticket)}`);

    const trialLicenses = await db
      .select()
      .from(licenses)
      .where(eq(licenses.transactionId, trialRes.transactionId));
    expect(trialLicenses.length).toBe(0);

    // 4. Status polling returns retail rail & appId with valid ticket, and transitions PENDING -> FAILED when gateway reports CANCELED/FAILED
    const retailTxId = `tx_ret_${suffix}`;
    await db.insert(transactions).values({
      id: retailTxId,
      appId,
      builderId: b.id,
      mode: "live",
      paymentProvider: "xendit",
      providerReferenceId: `pr-ret-${suffix}`,
      xenditExternalId: `ext_ret_${suffix}`,
      customerEmail: "buyer@example.invalid",
      grossAmount: 65000,
      platformFee: 3250,
      netAmount: 61750,
      paymentChannel: "ALFAMART",
      paymentCode: "ALFA889900",
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
      grantDays: 365,
    });

    const retailTicket = createPollTicket(retailTxId);
    const qSpy = spyOn(xenditGateway, "queryOrderStatus")
      .mockResolvedValueOnce({ isPaid: false, isExpired: false, isFailed: false })
      .mockResolvedValueOnce({ isPaid: false, isExpired: false, isFailed: true });

    const pendingStatus: any = await handleGetPaymentStatus({
      params: { txId: retailTxId },
      query: { ticket: retailTicket, sync: "true" },
      request: new Request("http://localhost:8081"),
      set: {},
    });
    expect(pendingStatus.paymentStatus).toBe("PENDING");
    expect(pendingStatus.appId).toBe(appId);
    expect(pendingStatus.paymentRail).toBe("retail");
    expect(pendingStatus.retailOutlet).toBe("ALFAMART");

    const failedStatus: any = await handleGetPaymentStatus({
      params: { txId: retailTxId },
      query: { ticket: retailTicket, sync: "true" },
      request: new Request("http://localhost:8081"),
      set: {},
    });
    expect(failedStatus.paymentStatus).toBe("FAILED");
    qSpy.mockRestore();

    // 5. Webhook handles data.id fallback + payment_request.expiry & CANCELED
    const expTxId = `tx_exp_${suffix}`;
    const prExpId = `pr-exp-${suffix}`;
    await db.insert(transactions).values({
      id: expTxId,
      appId,
      builderId: b.id,
      mode: "live",
      paymentProvider: "xendit",
      xenditInvoiceId: prExpId,
      providerReferenceId: prExpId,
      xenditExternalId: `ext_exp_${suffix}`,
      customerEmail: "buyer2@example.invalid",
      grossAmount: 65000,
      platformFee: 3250,
      netAmount: 61750,
      paymentChannel: "QRIS",
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
      grantDays: 365,
    });

    const verifySpy = spyOn(xenditGateway, "verifyWebhook").mockResolvedValue(true);
    const expWebhookRes: any = await handleXenditInvoiceWebhook({
      request: new Request("http://localhost:8081/api/v1/webhook/xendit", { method: "POST" }),
      headers: { "x-callback-token": "ok" },
      body: {
        event: "payment_request.expiry",
        data: { id: prExpId },
      },
      set: {},
    });
    expect(expWebhookRes.status).toBe("EXPIRED");
    verifySpy.mockRestore();

    const refreshedExp = await db.query.transactions.findFirst({
      where: eq(transactions.id, expTxId),
    });
    expect(refreshedExp?.paymentStatus).toBe("EXPIRED");

    await db.delete(licenses).where(eq(licenses.appId, appId));
    await db.delete(transactions).where(eq(transactions.appId, appId));
    await db.delete(apps).where(eq(apps.id, appId));
    await db.delete(builders).where(eq(builders.id, b.id));
  });

  it("returns delivery payload on sandbox simulate-payment and zeroes targetPrice when app is updated to pricingType=free", async () => {
    const suffix = randomBytes(4).toString("hex");
    const [b] = await db
      .insert(builders)
      .values({
        name: "Sim Builder",
        email: `sim_${suffix}@example.invalid`,
        apiKey: `key_sim_${suffix}`,
      })
      .returning();

    const sbAppId = `app_sim_${suffix}`;
    await db.insert(apps).values({
      id: sbAppId,
      slug: `slug-sim-${suffix}`,
      builderId: b.id,
      name: "Sandbox Delivery App",
      mode: "sandbox",
      targetPrice: 50000,
      deliveryConfig: {
        licenseKey: { enabled: true, expiresInDays: 30, maxSeats: 2 },
        fileDownload: {
          enabled: true,
          title: "Installer ZIP",
          fileUrl: "https://cdn.example.invalid/app.zip",
          fileName: "app.zip",
        },
        privateNote: {
          enabled: true,
          title: "Panduan",
          note: "Ekstrak lalu jalankan",
        },
      },
    });

    const sbTxId = `tx_sim_${suffix}`;
    await db.insert(transactions).values({
      id: sbTxId,
      appId: sbAppId,
      builderId: b.id,
      mode: "sandbox",
      paymentProvider: "sandbox",
      xenditExternalId: `ext_sim_${suffix}`,
      customerEmail: "tester@example.invalid",
      grossAmount: 50000,
      platformFee: 0,
      netAmount: 50000,
      paymentChannel: "QRIS",
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
      grantDays: 30,
    });

    const simRes: any = await handleSimulateSandboxPayment({
      request: new Request("http://localhost:8081/api/v1/sandbox/simulate-payment", {
        method: "POST",
      }),
      body: { transactionId: sbTxId, ticket: createPollTicket(sbTxId) },
      set: {},
    });
    expect(simRes.success).toBe(true);
    expect(simRes.paymentStatus).toBe("PAID");
    expect(simRes.delivery?.fileDownload?.fileUrl).toBe("https://cdn.example.invalid/app.zip");
    expect(simRes.delivery?.privateNote?.note).toBe("Ekstrak lalu jalankan");

    // Admin/owner update to pricingType="free" without targetPrice forces targetPrice=0
    const updRes: any = await handleUpdateApp({
      params: { appId: sbAppId },
      body: { pricingType: "free" },
      set: {},
      request: {
        headers: new Headers({ cookie: authCookie }),
      },
    });
    expect(updRes.success).toBe(true);
    expect(updRes.app.pricingType).toBe("free");
    expect(updRes.app.targetPrice).toBe(0);

    await db.delete(licenses).where(eq(licenses.appId, sbAppId));
    await db.delete(transactions).where(eq(transactions.appId, sbAppId));
    await db.delete(apps).where(eq(apps.id, sbAppId));
    await db.delete(builders).where(eq(builders.id, b.id));
  });

  it("enforces webhook app ownership (no IDOR), syncs app webhookUrl to webhook_endpoints, scopes coupons/events when builder=null, and excludes refunding tx in payout summary", async () => {
    const suffix = randomBytes(4).toString("hex");
    const password = "TestPassword123!";
    const emailA = `whA_${suffix}@tertaut-test.com`;
    const emailB = `whB_${suffix}@tertaut-test.com`;

    const resA = await auth.api.signUpEmail({
      body: { email: emailA, password, name: "Builder A" },
      asResponse: true,
    });
    const cookieA = (resA.headers.get("set-cookie") || "").split(";")[0];
    const dataA = await resA.json();

    const resB = await auth.api.signUpEmail({
      body: { email: emailB, password, name: "Builder B" },
      asResponse: true,
    });
    const cookieB = (resB.headers.get("set-cookie") || "").split(";")[0];
    const dataB = await resB.json();

    const [builderA] = await db
      .insert(builders)
      .values({ userId: dataA.user.id, email: emailA, name: "Builder A", apiKey: `kA_${suffix}` })
      .returning();
    const [builderB] = await db
      .insert(builders)
      .values({ userId: dataB.user.id, email: emailB, name: "Builder B", apiKey: `kB_${suffix}` })
      .returning();

    // 1. handleCreateApp validates SSRF & syncs webhookUrl -> webhookEndpoints
    const ssrfCreate: any = await handleCreateApp({
      body: {
        name: "SSRF App",
        slug: `ssrf-${suffix}`,
        targetPrice: 50000,
        webhookUrl: "http://127.0.0.1:9999/hook",
      },
      set: {},
      request: { headers: new Headers({ cookie: cookieA }) },
    });
    expect(ssrfCreate.error).toBeDefined();

    const createAppRes: any = await handleCreateApp({
      body: {
        name: "Webhook Sync App",
        slug: `whsync-${suffix}`,
        targetPrice: 50000,
        mode: "live",
        webhookUrl: "https://hooks.example.com/app-a",
      },
      set: {},
      request: { headers: new Headers({ cookie: cookieA }) },
    });
    expect(createAppRes.success).toBe(true);
    const appAId = createAppRes.app.id;

    const syncedEndpoint = await db.query.webhookEndpoints.findFirst({
      where: eq(webhookEndpoints.appId, appAId),
    });
    expect(syncedEndpoint?.url).toBe("https://hooks.example.com/app-a");
    expect(syncedEndpoint?.builderId).toBe(builderA.id);

    // 2. Webhook IDOR: Builder B cannot attach webhook or overwrite appA.webhookUrl
    const idorSet: any = {};
    const idorCreate: any = await handleCreateWebhook({
      body: { appId: appAId, url: "https://evil.example.com/steal" },
      request: { headers: new Headers({ cookie: cookieB }) },
      set: idorSet,
    });
    expect(idorCreate.success).toBe(false);
    expect(idorSet.status).toBe(403);

    const bOwnEndpoint: any = await handleCreateWebhook({
      body: { url: "https://hooks.example.com/b-own" },
      request: { headers: new Headers({ cookie: cookieB }) },
      set: {},
    });
    expect(bOwnEndpoint.success).toBe(true);

    const idorUpdSet: any = {};
    const idorUpdate: any = await handleUpdateWebhook({
      params: { id: bOwnEndpoint.webhook.id },
      body: { appId: appAId, url: "https://evil.example.com/overwrite" },
      request: { headers: new Headers({ cookie: cookieB }) },
      set: idorUpdSet,
    });
    expect(idorUpdate.success).toBe(false);
    expect(idorUpdSet.status).toBe(403);

    const appAAfter = await db.query.apps.findFirst({ where: eq(apps.id, appAId) });
    expect(appAAfter?.webhookUrl).toBe("https://hooks.example.com/app-a");

    // 3. Multi-tenant empty guard when !isAdmin && !builder
    await db.insert(coupons).values({
      id: `cpn_scope_${suffix}`,
      appId: appAId,
      code: `SCOPE${suffix.toUpperCase()}`,
      discountPercent: 20,
      isActive: true,
    });
    const resolverSpy = spyOn(builderModule, "resolveCurrentBuilder").mockResolvedValue({
      builder: null,
      isAdmin: false,
    });
    const couponListRes = await elysiaApp.handle(
      new Request("http://localhost:8081/api/v1/coupons", { headers: { cookie: cookieB } })
    );
    const couponListJson: any = await couponListRes.json();
    expect(couponListJson.coupons).toEqual([]);

    const couponStatsRes = await elysiaApp.handle(
      new Request("http://localhost:8081/api/v1/coupons/stats", { headers: { cookie: cookieB } })
    );
    const couponStatsJson: any = await couponStatsRes.json();
    expect(couponStatsJson.totalRedemptions).toBe(0);

    const eventsRes: any = await handleListEvents({
      query: {},
      request: { headers: new Headers({ cookie: cookieB }) },
      set: {},
    });
    expect(eventsRes.events).toEqual([]);
    resolverSpy.mockRestore();

    // 4. GET /payouts/summary excludes refundStatus=PROCESSING from availableBalance
    const txReadyId = `tx_pay_ok_${suffix}`;
    const txRefundingId = `tx_pay_rfd_${suffix}`;
    await db.insert(transactions).values([
      {
        id: txReadyId,
        appId: appAId,
        builderId: builderA.id,
        mode: "live",
        paymentProvider: "xendit",
        xenditExternalId: `ext_ok_${suffix}`,
        customerEmail: "a@example.invalid",
        grossAmount: 100000,
        platformFee: 5000,
        netAmount: 95000,
        paymentStatus: "PAID",
        refundStatus: "NONE",
        disbursementStatus: "PENDING",
      },
      {
        id: txRefundingId,
        appId: appAId,
        builderId: builderA.id,
        mode: "live",
        paymentProvider: "xendit",
        xenditExternalId: `ext_rfd_${suffix}`,
        customerEmail: "b@example.invalid",
        grossAmount: 100000,
        platformFee: 5000,
        netAmount: 95000,
        paymentStatus: "PAID",
        refundStatus: "PROCESSING",
        disbursementStatus: "PENDING",
      },
    ]);

    const summaryRes = await elysiaApp.handle(
      new Request("http://localhost:8081/api/v1/payouts/summary?mode=live", {
        headers: { cookie: cookieA },
      })
    );
    const summaryJson: any = await summaryRes.json();
    expect(summaryJson.success).toBe(true);
    expect(summaryJson.kpis.availableBalance).toBe(95000);
    expect(summaryJson.kpis.availableCount).toBe(1);
    expect(summaryJson.minThreshold).toBeGreaterThanOrEqual(10000);

    await db.delete(coupons).where(eq(coupons.appId, appAId));
    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.builderId, builderA.id));
    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.builderId, builderB.id));
    await db.delete(transactions).where(eq(transactions.appId, appAId));
    await db.delete(apps).where(eq(apps.id, appAId));
    await db.delete(builders).where(eq(builders.id, builderA.id));
    await db.delete(builders).where(eq(builders.id, builderB.id));
  });

  it("covers panel revoke jti denylist, non-license apiAccess email/delivery, dashboard dynamic checkout, badge redirect/embed host, subscription renewal, and pending tx expiry", async () => {
    const suffix = randomBytes(4).toString("hex");
    const secretKey = `tt_secret_test_${suffix}`;
    const [b] = await db
      .insert(builders)
      .values({
        name: "Audit Builder",
        email: `aud_${suffix}@example.invalid`,
        apiKey: `k_aud_${suffix}`,
        secretApiKey: secretKey,
      })
      .returning();

    // 1. Panel revoke denylists real offline token jti & reactivate clears it
    const subAppId = `app_sub_${suffix}`;
    const subSlug = `sub-slug-${suffix}`;
    await db.insert(apps).values({
      id: subAppId,
      slug: subSlug,
      builderId: b.id,
      name: "Sub App",
      mode: "sandbox",
      pricingType: "subscription",
      billingPeriod: "monthly",
      targetPrice: 50000,
      brandColor: "#EA580C",
      logoUrl: "https://cdn.example.invalid/logo.png",
      redirectUrl: "https://merchant.example.invalid/thanks",
    });

    const issued = await LicenseService.issueDirect({
      appId: subAppId,
      customerEmail: `sub_${suffix}@example.invalid`,
      grantDays: 30,
    });
    const decoded = await LicenseTokenService.verify(issued.license.offlineJwtGraceToken!);
    const realJti = decoded.claims!.jti;

    await handlePanelRevokeLicense({
      params: { id: issued.license.id },
      body: { reason: "Abuse" },
      set: {},
    });
    const revRow = await db.query.revokedTokens.findFirst({
      where: eq(revokedTokens.jti, realJti),
    });
    expect(revRow).toBeDefined();

    await handlePanelReactivateLicense({ params: { id: issued.license.id }, set: {} });
    const revAfter = await db.query.revokedTokens.findFirst({
      where: eq(revokedTokens.jti, realJti),
    });
    expect(revAfter).toBeUndefined();

    // 2. Subscription repurchase by same customer extends existing license instead of duplicating
    const txSubId = `tx_sub_renew_${suffix}`;
    await db.insert(transactions).values({
      id: txSubId,
      appId: subAppId,
      builderId: b.id,
      mode: "sandbox",
      paymentProvider: "sandbox",
      xenditExternalId: `ext_sub_${suffix}`,
      customerEmail: `sub_${suffix}@example.invalid`,
      grossAmount: 50000,
      platformFee: 0,
      netAmount: 50000,
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
      grantDays: 30,
    });
    const renewFulfill = await fulfillPaymentTransaction(
      {
        id: txSubId,
        appId: subAppId,
        customerEmail: `sub_${suffix}@example.invalid`,
        grantDays: 30,
      },
      "QRIS"
    );
    expect(renewFulfill.licenseKey).toBe(issued.license.licenseKey);

    // 3. Badge click goes to /pay/:slug (not redirectUrl) and embed.js uses server origin
    const clickRes = await elysiaApp.handle(
      new Request(`http://localhost:8081/api/v1/badge/${subSlug}/click`)
    );
    expect(clickRes.status).toBe(302);
    expect(clickRes.headers.get("location")).toContain(`/pay/${subSlug}`);
    expect(clickRes.headers.get("location")).not.toContain("merchant.example.invalid");

    const embedRes = await elysiaApp.handle(
      new Request("https://tertaut.com/api/v1/widgets/embed.js")
    );
    const embedJs = await embedRes.text();
    expect(embedJs).toContain('"https://tertaut.com"');
    expect(embedJs).not.toContain("window.location.origin");

    // 4. handleGetBySlug exposes brandColor & logoUrl and omits legacy customIntentMessage/pageBlocks
    const pubApp: any = await handleGetBySlug({ params: { slug: subSlug }, set: {} });
    expect(pubApp.brandColor).toBe("#EA580C");
    expect(pubApp.logoUrl).toBe("https://cdn.example.invalid/logo.png");
    expect(pubApp.customIntentMessage).toBeUndefined();
    expect(pubApp.pageBlocks).toBeUndefined();

    // 5. Non-license paid product with apiAccess=true sends email and returns apiAccess in status & invoice
    const apiAppId = `app_api_${suffix}`;
    await db.insert(apps).values({
      id: apiAppId,
      slug: `api-slug-${suffix}`,
      builderId: b.id,
      name: "API Only Product",
      mode: "sandbox",
      appType: "saas_web",
      targetPrice: 0,
      deliveryConfig: {
        licenseKey: { enabled: false },
        apiAccess: {
          enabled: true,
          endpointUrl: "https://api.example.invalid/v1",
          instruction: "Use Bearer",
        },
      },
    });
    const emailSpy = spyOn(EmailService, "sendLicenseIssued").mockResolvedValue({
      ok: true,
    } as any);

    // S2S caller / dashboard session can create dynamic saas_web checkout with grantDays & gets hostedPayUrl
    const dynRes: any = await handleCreateSession({
      request: new Request("https://tertaut.com/api/v1/checkout/session", {
        method: "POST",
        headers: new Headers({
          authorization: `Bearer ${b.secretApiKey}`,
        }),
      }),
      body: { appId: apiAppId, customerEmail: "api@example.invalid", amount: 75000, grantDays: 45 },
      set: {},
    });
    expect(dynRes.success).toBe(true);
    expect(dynRes.amount).toBe(75000);
    expect(dynRes.grantDays).toBe(45);
    expect(dynRes.hostedPayUrl).toContain(`/pay/api-slug-${suffix}`);
    expect(dynRes.hostedPayUrl).toContain("ticket=");

    await fulfillPaymentTransaction(
      {
        id: dynRes.transactionId,
        appId: apiAppId,
        customerEmail: "api@example.invalid",
        grantDays: 45,
      },
      "QRIS"
    );
    expect(emailSpy).toHaveBeenCalledTimes(1);
    emailSpy.mockRestore();

    const apiStatus: any = await handleGetPaymentStatus({
      params: { txId: dynRes.transactionId },
      query: { ticket: dynRes.ticket },
      request: new Request("http://localhost:8081"),
      set: {},
    });
    expect(apiStatus.delivery?.apiAccess?.apiKey).toMatch(/^tt_cust_/);

    const apiInv: any = await handleGetInvoiceData({
      params: { txId: dynRes.transactionId },
      query: { ticket: dynRes.ticket },
      request: new Request("http://localhost:8081"),
      set: {},
    });
    expect(apiInv.invoice?.delivery?.apiAccess?.apiKey).toMatch(/^tt_cust_/);

    // 6. expirePendingTransactions marks stale PENDING tx EXPIRED & rolls back coupon redemptionCount
    const cpnId = `cpn_exp_${suffix}`;
    const cpnCode = `EXP${suffix.toUpperCase()}`;
    await db.insert(coupons).values({
      id: cpnId,
      appId: subAppId,
      code: cpnCode,
      discountPercent: 10,
      maxRedemptions: 5,
      redemptionCount: 1,
      isActive: true,
    });
    const staleTxId = `tx_stale_${suffix}`;
    await db.insert(transactions).values({
      id: staleTxId,
      appId: subAppId,
      builderId: b.id,
      mode: "sandbox",
      paymentProvider: "sandbox",
      xenditExternalId: `ext_stale_${suffix}`,
      customerEmail: "stale@example.invalid",
      grossAmount: 45000,
      platformFee: 0,
      netAmount: 45000,
      couponCode: cpnCode,
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
      paymentExpiresAt: new Date(Date.now() - 60_000),
    });

    await expirePendingTransactions();
    const staleAfter = await db.query.transactions.findFirst({
      where: eq(transactions.id, staleTxId),
    });
    const cpnAfter = await db.query.coupons.findFirst({ where: eq(coupons.id, cpnId) });
    expect(staleAfter?.paymentStatus).toBe("EXPIRED");
    expect(cpnAfter?.redemptionCount).toBe(0);

    await db.delete(coupons).where(eq(coupons.appId, subAppId));
    await db.delete(revokedTokens).where(eq(revokedTokens.licenseId, issued.license.id));
    await db.delete(licenses).where(eq(licenses.appId, subAppId));
    await db.delete(transactions).where(eq(transactions.appId, subAppId));
    await db.delete(transactions).where(eq(transactions.appId, apiAppId));
    await db.delete(apps).where(eq(apps.id, subAppId));
    await db.delete(apps).where(eq(apps.id, apiAppId));
    await db.delete(builders).where(eq(builders.id, b.id));
  });
});
