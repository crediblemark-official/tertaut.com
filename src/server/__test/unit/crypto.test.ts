import { describe, it, expect } from "bun:test";
import { CryptoService } from "../../services/crypto";

describe("Unit Tests - CryptoService", () => {
  it("should handle key derivation branches properly", () => {
    const plain = "secret-tertaut-payload-12345";
    const encrypted = CryptoService.encrypt(plain);
    const decrypted = CryptoService.decrypt(encrypted.cipherText, encrypted.iv, encrypted.authTag);
    expect(decrypted).toBe(plain);
  });

  it("should throw error when decrypting with tampered data or authTag", () => {
    const plain = "tamper-proof-test";
    const encrypted = CryptoService.encrypt(plain);

    // Tampered ciphertext
    expect(() => {
      CryptoService.decrypt("00" + encrypted.cipherText.slice(2), encrypted.iv, encrypted.authTag);
    }).toThrow();

    // Tampered authTag
    expect(() => {
      CryptoService.decrypt(encrypted.cipherText, encrypted.iv, "00" + encrypted.authTag.slice(2));
    }).toThrow();
  });

  it("should create and verify signed JWT tokens correctly", () => {
    const payload = { userId: "usr_123", role: "builder", app: "app_xyz" };
    const token = CryptoService.createSignedToken(payload, 3600);

    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    // Verify valid token
    const verified = CryptoService.verifySignedToken<typeof payload>(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe("usr_123");
    expect(verified?.role).toBe("builder");
    expect(verified?.app).toBe("app_xyz");
  });

  it("should reject tampered, malformed, or expired signed JWT tokens", () => {
    // Malformed token
    expect(CryptoService.verifySignedToken("invalid.token")).toBeNull();
    expect(CryptoService.verifySignedToken("one.two.three.four")).toBeNull();
    expect(CryptoService.verifySignedToken("")).toBeNull();

    // Tampered token signature
    const token = CryptoService.createSignedToken({ id: "valid_token" }, 3600);
    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.badsignature`;
    expect(CryptoService.verifySignedToken(tampered)).toBeNull();

    // Expired token (expires in -10 seconds)
    const expiredToken = CryptoService.createSignedToken({ id: "expired_token" }, -10);
    expect(CryptoService.verifySignedToken(expiredToken)).toBeNull();
  });
});
