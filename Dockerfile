# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: Build Frontend Vue 3 SPA (Vite)
#
# Semua dependency build (vite, vue-tsc, tailwind, postcss) berada di
# package.json ROOT, bukan di src/client. Karena itu build dijalankan dari
# root repo. vite.config.ts meng-output hasil ke <root>/dist.
# ---------------------------------------------------------------------------
FROM oven/bun:1.3.14-alpine AS client-builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src/client ./src/client
RUN bun run build:client

# ---------------------------------------------------------------------------
# Stage 2: Production Server (single container monolith)
#
# Elysia menyajikan SPA hasil build sekaligus API pada port yang sama.
# src/server/index.ts mencari aset SPA di resolve(import.meta.dir, "../../dist"),
# yaitu /app/src/server/../../dist => /app/dist
# ---------------------------------------------------------------------------
FROM oven/bun:1.3.14-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Bun runtime optimasi
ENV BUN_LOG_SCOPE="*"
ENV BUN_JSX_RUNTIME="haste"

# Hanya dependency runtime + terser (untuk build:client yang sudah selesai)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Sumber server (termasuk src/server/db/migrations untuk `bun run db:migrate`)
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY src/server ./src/server

# Aset SPA hasil build dari stage 1
COPY --from=client-builder /app/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/health" || exit 1

CMD ["bun", "src/server/index.ts"]
