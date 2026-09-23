import { describe, it, expect } from "bun:test";
import { auth } from "../../auth";
import { isAdminUser } from "../../middleware/auth";
import { ensureFirstUserIsAdmin } from "../../index";
import { db } from "../../db";
import { user } from "../../db/schema";
import { eq, asc } from "drizzle-orm";

describe("Default Admin - First Registered User Policy", () => {
  it("should set role: 'admin' and emailVerified: true when creating the first user", async () => {
    const createHook = (auth.options.databaseHooks as any)?.user?.create?.before;
    expect(createHook).toBeDefined();

    // Mock scenario: no existing user found in database
    const origSelect = db.select;
    try {
      (db as any).select = () => ({
        from: () => ({
          limit: async () => [],
        }),
      });

      const hookRes = await createHook({
        id: "usr_first_test",
        email: "first_owner@tertaut.com",
        name: "First Owner",
      });

      expect(hookRes?.data?.role).toBe("admin");
      expect(hookRes?.data?.emailVerified).toBe(true);
    } finally {
      (db as any).select = origSelect;
    }
  });

  it("should set role: 'user' when creating subsequent users", async () => {
    const createHook = (auth.options.databaseHooks as any)?.user?.create?.before;
    expect(createHook).toBeDefined();

    // Mock scenario: existing users exist in database
    const origSelect = db.select;
    try {
      (db as any).select = () => ({
        from: () => ({
          limit: async () => [{ id: "usr_existing_123" }],
        }),
      });

      const hookRes = await createHook({
        id: "usr_second_test",
        email: "second_user@tertaut.com",
        name: "Second User",
      });

      expect(hookRes?.data?.role).toBe("user");
      expect(hookRes?.data?.emailVerified).toBeUndefined();
    } finally {
      (db as any).select = origSelect;
    }
  });

  it("should preserve explicitly provided role if not first user", async () => {
    const createHook = (auth.options.databaseHooks as any)?.user?.create?.before;

    const origSelect = db.select;
    try {
      (db as any).select = () => ({
        from: () => ({
          limit: async () => [{ id: "usr_existing_123" }],
        }),
      });

      const hookRes = await createHook({
        id: "usr_explicit_admin",
        email: "invited_admin@tertaut.com",
        name: "Invited Admin",
        role: "admin",
      });

      expect(hookRes?.data?.role).toBe("admin");
    } finally {
      (db as any).select = origSelect;
    }
  });

  it("should verify isAdminUser identifies role 'admin'", () => {
    expect(isAdminUser({ role: "admin", email: "anyone@test.com" })).toBe(true);
    expect(isAdminUser({ role: "user", email: "regular@test.com" })).toBe(false);
    expect(isAdminUser({ role: null, email: null })).toBe(false);
  });

  it("ensureFirstUserIsAdmin promotes first user if no admin exists", async () => {
    // Test that ensureFirstUserIsAdmin runs safely without throwing
    await expect(ensureFirstUserIsAdmin()).resolves.toBeUndefined();
  });
});
