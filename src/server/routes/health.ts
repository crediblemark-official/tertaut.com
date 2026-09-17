import { Elysia } from "elysia";

export const healthRoutes = new Elysia({ prefix: "/health" })
  .get("/", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }), {
    detail: {
      tags: ["System"],
      summary: "Health Check",
      description: "Returns the health and operational status of tertaut.com engine",
    },
  });
