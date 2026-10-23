import { expect, test } from "bun:test";

// The probes mock DB and gateways. A subprocess keeps those mocks out of the
// shared integration-test process, even when Bun executes every file together.
test("codebase audit regressions pass in an isolated process", async () => {
  const child = Bun.spawn([process.execPath, "test", "./scripts/audit/regressions.test.ts"], {
    cwd: new URL("../../../../", import.meta.url).pathname,
    env: { ...process.env, NODE_ENV: "test" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(exitCode, stdout + stderr).toBe(0);
}, 30_000);
