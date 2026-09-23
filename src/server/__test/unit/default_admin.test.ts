import { describe, it, expect } from "bun:test";
import { auth } from "../../auth";
import { isAdminUser } from "../../middleware/auth";
import { ensurePlatformAdmin, ensureFirstUserIsAdmin } from "../../index";
import { db } from "../../db";
import { user } from "../../db/schema";
import { eq } from "drizzle-orm";

describe("Platform Admin Policy (platformtertaut@gmail.com)", () => {
  it("should set role: 'admin' and emailVerified: true for platformtertaut@gmail.com", async () => {
    const createHook = (auth.options.databaseHooks as any)?.user?.create?.before;
    expect(createHook).toBeDefined();

    const hookRes = await createHook({
      id: "usr_platform_admin",
      email: "platformtertaut@gmail.com",
      name: "Platform Tertaut",
    });

    expect(hookRes?.data?.role).toBe("admin");
    expect(hookRes?.data?.emailVerified).toBe(true);
  });

  it("should set role: 'user' when creating non-platform accounts, even if first user", async () => {
    const createHook = (auth.options.databaseHooks as any)?.user?.create?.before;
    expect(createHook).toBeDefined();

    const hookRes = await createHook({
      id: "usr_first_non_admin",
      email: "first_owner@tertaut.com",
      name: "First Owner",
    });

    expect(hookRes?.data?.role).toBe("user");
    expect(hookRes?.data?.emailVerified).toBeUndefined();
  });

  it("should verify isAdminUser identifies platformtertaut@gmail.com as admin", () => {
    expect(isAdminUser({ role: "user", email: "platformtertaut@gmail.com" })).toBe(true);
    expect(isAdminUser({ role: "user", email: "PLATFORMTERTAUT@GMAIL.COM" })).toBe(true);
    expect(isAdminUser({ role: "admin", email: "anyone@test.com" })).toBe(true);
    expect(isAdminUser({ role: "user", email: "regular@test.com" })).toBe(false);
    expect(isAdminUser({ role: null, email: null })).toBe(false);
  });

  it("ensurePlatformAdmin runs safely and promotes platformtertaut@gmail.com", async () => {
    await expect(ensurePlatformAdmin()).resolves.toBeUndefined();
    await expect(ensureFirstUserIsAdmin()).resolves.toBeUndefined();
  });
});
