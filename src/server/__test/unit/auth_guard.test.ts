import { describe, it, expect } from "bun:test";
import { authenticate } from "../../middleware/auth";

describe("Unit Tests - Auth Middleware & Guard", () => {
  it("should strictly reject unauthenticated requests with 401 Unauthorized (DEV_USER eliminated)", async () => {
    // Empty headers -> unauthenticated -> status 401
    const res = await authenticate(new Headers());
    expect(res).toEqual({ status: 401, error: "Unauthorized" });
  });

  it("should strictly reject unauthenticated admin requests with 401", async () => {
    // Admin check without session -> status 401
    const res = await authenticate(new Headers(), true);
    expect(res).toEqual({ status: 401, error: "Unauthorized" });
  });
});
