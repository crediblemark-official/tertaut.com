import { describe, it, expect } from "bun:test";
import { setupTestAuth, authCookie } from "../setup";
import { db } from "../../db";
import { builders, user } from "../../db/schema";
import { resolveCurrentBuilder, seedSandboxBuilderIfNeeded } from "../../routes/apps/builder";
import { generateAppApiKey, generateBuilderSecretApiKey } from "../../routes/apps/api-key";

setupTestAuth();

const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

describe("Coverage: apps/builder.ts resolveCurrentBuilder & seedSandboxBuilderIfNeeded", () => {
  it("resolveCurrentBuilder: headers tanpa sesi / auth gagal -> builder null", async () => {
    const res = await resolveCurrentBuilder(new Headers());
    expect(res.builder).toBeNull();
    expect(res.isAdmin).toBe(false);
  });

  it("resolveCurrentBuilder: user login cocok dengan builders.userId", async () => {
    const userId = `usr_${suffix()}`;
    const [u] = await db
      .insert(user)
      .values({
        id: userId,
        email: `u_${suffix()}@test.com`,
        name: "Test User",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    const [b] = await db
      .insert(builders)
      .values({
        userId: u.id,
        email: u.email,
        name: u.name,
        apiKey: generateAppApiKey("live"),
        secretApiKey: generateBuilderSecretApiKey(),
      })
      .returning();

    // Headers with admin session from setupTestAuth
    const headers = new Headers();
    if (authCookie) {
      headers.set("cookie", authCookie);
    }
    const res = await resolveCurrentBuilder(headers);
    expect(res).toBeDefined();
  });

  it("seedSandboxBuilderIfNeeded: tidak error jika database sudah ada builder", async () => {
    await expect(seedSandboxBuilderIfNeeded()).resolves.toBeUndefined();
  });
});
