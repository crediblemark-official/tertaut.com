import { describe, it, expect } from "bun:test";
import { XenditService } from "../../services/xendit";
import { config } from "../../config";

describe("Unit Tests - XenditService", () => {
  it("should calculate correct MoR breakdown (5% platform fee, 95% net)", () => {
    const breakdown1 = XenditService.calculateMorBreakdown(100_000);
    expect(breakdown1.grossAmount).toBe(100_000);
    expect(breakdown1.platformFee).toBe(5_000);
    expect(breakdown1.netAmount).toBe(95_000);

    const breakdown2 = XenditService.calculateMorBreakdown(50_000);
    expect(breakdown2.grossAmount).toBe(50_000);
    expect(breakdown2.platformFee).toBe(2_500);
    expect(breakdown2.netAmount).toBe(47_500);
  });

  it("should resolve disbursement account for valid bank, sandbox fallback, or live mode", () => {
    // Valid bank account on builder
    const acc = XenditService.resolveDisbursementAccount({
      name: "Budi Builder",
      disbursementAccount: {
        bankCode: "MANDIRI",
        accountNumber: "1400012345678",
        accountHolderName: "Budi Santoso",
      },
    });
    expect(acc?.bankCode).toBe("MANDIRI");
    expect(acc?.accountNumber).toBe("1400012345678");
    expect(acc?.accountHolderName).toBe("Budi Santoso");

    // Sandbox fallback
    const origSandbox = config.isSandbox;
    config.isSandbox = true;
    const sandboxAcc = XenditService.resolveDisbursementAccount({
      name: "Demo Builder",
      disbursementAccount: null,
    });
    expect(sandboxAcc?.bankCode).toBe("BCA");
    expect(sandboxAcc?.accountHolderName).toBe("Demo Builder");

    // Live mode rejection when no account configured
    config.isSandbox = false;
    const liveAcc = XenditService.resolveDisbursementAccount({
      name: "Live Builder",
      disbursementAccount: null,
    });
    expect(liveAcc).toBeNull();

    config.isSandbox = origSandbox;
  });

  it("should verify webhook token accurately", () => {
    const origToken = config.xendit.webhookToken;
    const origSandbox = config.isSandbox;

    // Configured token
    config.xendit.webhookToken = "valid_xendit_webhook_token_123";
    expect(XenditService.verifyWebhook("valid_xendit_webhook_token_123")).toBe(true);
    expect(XenditService.verifyWebhook("wrong_token")).toBe(false);

    // Unconfigured in sandbox bypass vs live rejection
    config.xendit.webhookToken = "";
    config.isSandbox = true;
    expect(XenditService.verifyWebhook(undefined)).toBe(true);

    config.isSandbox = false;
    expect(XenditService.verifyWebhook(undefined)).toBe(false);

    config.xendit.webhookToken = origToken;
    config.isSandbox = origSandbox;
  });

  it("should handle createInvoice in mock mode and throw if unconfigured in live", async () => {
    const origSandbox = config.isSandbox;
    const origKey = config.xendit.secretKey;

    // Mock enabled in sandbox
    config.isSandbox = true;
    config.xendit.secretKey = "";
    const mockInv = await XenditService.createInvoice({
      externalId: "ext_mock_123",
      amount: 150_000,
      payerEmail: "payer@example.com",
      description: "Test Mock Invoice",
    });
    expect(mockInv.status).toBe("PENDING");
    expect(mockInv.amount).toBe(150_000);
    expect(mockInv.external_id).toBe("ext_mock_123");

    // Live without secretKey throws error
    config.isSandbox = false;
    config.xendit.secretKey = "";
    expect(
      XenditService.createInvoice({
        externalId: "ext_live_123",
        amount: 150_000,
        payerEmail: "payer@example.com",
        description: "Live Invoice Fail",
      })
    ).rejects.toThrow();

    config.isSandbox = origSandbox;
    config.xendit.secretKey = origKey;
  });

  it("should create disbursement in mock mode and handle live failure if unconfigured", async () => {
    const origSandbox = config.isSandbox;
    const origKey = config.xendit.secretKey;

    config.isSandbox = true;
    config.xendit.secretKey = "";
    const disb = await XenditService.createDisbursement({
      externalId: "disb_test_123",
      amount: 95_000,
      bankCode: "BCA",
      accountHolderName: "Sandbox Builder",
      accountNumber: "1234567890",
      description: "Payout test",
    });
    expect(disb.status).toBe("COMPLETED");
    expect(disb.amount).toBe(95_000);

    config.isSandbox = false;
    config.xendit.secretKey = "";
    expect(
      XenditService.createDisbursement({
        externalId: "disb_test_fail",
        amount: 95_000,
        bankCode: "BCA",
        accountHolderName: "Live Builder",
        accountNumber: "1234567890",
        description: "Payout live fail",
      })
    ).rejects.toThrow();

    config.isSandbox = origSandbox;
    config.xendit.secretKey = origKey;
  });
});
