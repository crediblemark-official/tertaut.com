import { createHmac } from "crypto";
import { describe, it, expect } from "bun:test";
import {
  handleDanaFinishPaymentWebhook,
  handleDanaDisburseNotifyWebhook,
} from "../../routes/webhook/dana";
import { handleXenithPayWebhook } from "../../routes/webhook/xenithpay";
import { config } from "../../config";
import { danaWebhookHeaders } from "../setup";

describe("Unit Tests - Webhook Handlers", () => {
  it("should handle DANA finish payment webhook UAT scenarios (11012 and 11011)", async () => {
    const origSandbox = config.isSandbox;
    config.isSandbox = true;

    const set500: any = {};
    const body500 = { amount: { value: "11012" } };
    const res500: any = await handleDanaFinishPaymentWebhook({
      headers: danaWebhookHeaders(body500),
      body: body500,
      set: set500,
    });
    expect(set500.status).toBe(500);
    expect(res500.responseCode).toBe("5005601");

    const set200: any = {};
    const body200 = JSON.stringify({ amount: { value: "11011" } });
    const res200: any = await handleDanaFinishPaymentWebhook({
      headers: danaWebhookHeaders(body200),
      body: body200,
      set: set200,
    });
    expect(set200.status).toBe(200);
    expect(res200.responseCode).toBe("2005600");

    config.isSandbox = origSandbox;
  });

  it("should reject DANA finish payment webhook on invalid signature", async () => {
    const origSandbox = config.isSandbox;
    const origPubKey = config.dana.publicKey;

    config.isSandbox = false;
    config.dana.publicKey = ""; // Live without public key must reject

    const set: any = {};
    const res: any = await handleDanaFinishPaymentWebhook({
      headers: { signature: "invalid_sig" },
      body: { amount: { value: "50000" } },
      set,
    });

    expect(set.status).toBe(401);
    expect(res.responseCode).toBe("4015600");

    config.isSandbox = origSandbox;
    config.dana.publicKey = origPubKey;
  });

  it("should acknowledge DANA finish webhook when transaction is missing or not found", async () => {
    const body = { merchantTransId: "tx_non_existent_99999" };
    const set: any = {};
    const res: any = await handleDanaFinishPaymentWebhook({
      headers: danaWebhookHeaders(body),
      body,
      set,
    });

    expect(res.responseCode).toBe("2005600");
  });

  it("should handle DANA disburse notify webhook completed, pending, and rejection", async () => {
    const origSandbox = config.isSandbox;
    const origPubKey = config.dana.publicKey;
    config.isSandbox = true;

    // Completed webhook
    const setOk: any = {};
    const bodyOk = {
      partnerReferenceNo: "disb_ext_999",
      status: "SUCCESS",
    };
    const resOk = await handleDanaDisburseNotifyWebhook({
      headers: danaWebhookHeaders(bodyOk),
      body: bodyOk,
      set: setOk,
    });
    expect(resOk.responseCode).toBe("2002900");
    expect(resOk.status).toBe("COMPLETED");

    // Pending webhook
    const bodyPending = {
      partnerReferenceNo: "disb_ext_999",
      status: "PENDING",
    };
    const resPending = await handleDanaDisburseNotifyWebhook({
      headers: danaWebhookHeaders(bodyPending),
      body: bodyPending,
      set: {},
    });
    expect(resPending.responseCode).toBe("2002900");

    // Rejected webhook in live mode with missing signature
    config.isSandbox = false;
    config.dana.publicKey = "";
    const setErr: any = {};
    const resErr = await handleDanaDisburseNotifyWebhook({
      headers: {},
      body: { status: "SUCCESS" },
      set: setErr,
    });
    expect(setErr.status).toBe(401);
    expect(resErr.error).toBe("Invalid Webhook Signature");

    config.isSandbox = origSandbox;
    config.dana.publicKey = origPubKey;
  });

  it("should verify and acknowledge XenithPay webhook callbacks", async () => {
    const origSandbox = config.isSandbox;
    const origSecret = config.xenithpay.sandboxWebhookSecret;
    const origProdSecret = config.xenithpay.webhookSecret;
    config.isSandbox = true;
    config.xenithpay.sandboxWebhookSecret = "xenith_test_secret";
    config.xenithpay.webhookSecret = "xenith_test_secret";

    const body = {
      event: "payment.success",
      referenceCode: "tt_xenith_test_001",
      status: "PAID",
      amount: 50000,
    };
    const timestamp = new Date().toISOString();
    const payload = `POST\n/api/v1/webhook/xenithpay\n${JSON.stringify(body)}\n${timestamp}`;
    const signature = createHmac("sha256", "xenith_test_secret").update(payload).digest("base64");

    const set: any = {};
    const res = await handleXenithPayWebhook({
      request: { method: "POST", url: "https://example.com/api/v1/webhook/xenithpay" },
      headers: {
        "x-xenith-timestamp": timestamp,
        "x-xenith-signature": signature,
      },
      body,
      set,
    });

    expect(res.received).toBe(true);
    expect(res.acknowledged).toBe(true);

    config.isSandbox = origSandbox;
    config.xenithpay.sandboxWebhookSecret = origSecret;
    config.xenithpay.webhookSecret = origProdSecret;
  });
});
