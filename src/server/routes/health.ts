import { Elysia } from "elysia";

export const healthRoutes = new Elysia({ prefix: "/health" })
  .get("/", () => ({
    status: "ok",
    engine: "tertaut.com",
    version: "2.2.0",
    timestamp: new Date().toISOString(),
    runtime: "Bun",
  }), {
    detail: {
      tags: ["System"],
      summary: "Health Check",
      description: "Returns the health and operational status of tertaut.com engine",
    },
  });
