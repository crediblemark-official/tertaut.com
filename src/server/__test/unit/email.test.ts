import { describe, it, expect } from "bun:test";
import { EmailService } from "../../services/email";
import { config } from "../../config";

describe("Unit Tests - EmailService", () => {
  it("should report isConfigured based on config", () => {
    const originalKey = config.email.resendApiKey;
    const originalFrom = config.email.from;

    config.email.resendApiKey = "";
    expect(EmailService.isConfigured()).toBe(false);

    config.email.resendApiKey = "re_test_123";
    config.email.from = "Tertaut <noreply@tertaut.com>";
    expect(EmailService.isConfigured()).toBe(true);

    // Restore
    config.email.resendApiKey = originalKey;
    config.email.from = originalFrom;
  });

  it("should skip sending when unconfigured", async () => {
    const originalKey = config.email.resendApiKey;
    config.email.resendApiKey = "";

    const res = await EmailService.send({
      to: "buyer@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
    });

    expect(res.ok).toBe(false);
    expect(res.skipped).toBe(true);

    config.email.resendApiKey = originalKey;
  });

  it("should send email via Resend and handle 200, error responses, and exceptions", async () => {
    EmailService.resetQuotaBlock();
    const originalKey = config.email.resendApiKey;
    const originalFrom = config.email.from;
    const originalFetch = globalThis.fetch;

    try {
      // Test ini memeriksa layer HTTP (fetch mock) — paksa pengiriman aktif,
      // karena default-nya email hanya dikirim di production.
      EmailService.setSendOverride(true);
      config.email.resendApiKey = "re_mock_test_key";
      config.email.from = "Tertaut <noreply@tertaut.com>";

      // Mock successful 200 response
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ id: "email_msg_999" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as any;

      const okResult = await EmailService.send({
        to: "success@example.com",
        subject: "Success Subject",
        html: "<p>Success</p>",
        text: "Success",
        replyTo: "support@tertaut.com",
      });
      expect(okResult.ok).toBe(true);
      expect(okResult.id).toBe("email_msg_999");

      // Mock 400 error response
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ message: "Invalid recipient" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }) as any;

      const errResult = await EmailService.send({
        to: "bad@example.com",
        subject: "Fail Subject",
        html: "<p>Fail</p>",
      });
      expect(errResult.ok).toBe(false);
      expect(errResult.error).toContain("400");

      // Mock network failure exception
      globalThis.fetch = (async () => {
        throw new Error("DNS resolution failed");
      }) as any;

      const netResult = await EmailService.send({
        to: "net@example.com",
        subject: "Net Subject",
        html: "<p>Net</p>",
      });
      expect(netResult.ok).toBe(false);
      expect(netResult.error).toContain("DNS resolution failed");

      // Test sendLicenseIssued helper
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ id: "email_lic_111" }), { status: 200 });
      }) as any;

      const licEmailRes = await EmailService.sendLicenseIssued({
        to: "buyer@example.com",
        appName: "Awesome App",
        licenseKey: "TT-TEST-AAAA-BBBB",
        expiresAt: new Date("2026-12-31T00:00:00.000Z"),
        customerName: "Buyer Test",
      });
      expect(licEmailRes.ok).toBe(true);
    } finally {
      // Restore
      globalThis.fetch = originalFetch;
      config.email.resendApiKey = originalKey;
      config.email.from = originalFrom;
      EmailService.resetQuotaBlock();
      EmailService.setSendOverride(null);
    }
  });
});
