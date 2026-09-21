# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: Build Frontend Vue 3 SPA (Vite) & Docs (VitePress)
# ---------------------------------------------------------------------------
FROM oven/bun:1-alpine AS client-builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src/client ./src/client
RUN bun run build:client

COPY docs ./docs
RUN bun run build:docs || true

# ---------------------------------------------------------------------------
# Stage 2: Production Server (single container monolith)
# ---------------------------------------------------------------------------
FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
# Bun runtime optimasi
ENV BUN_LOG_SCOPE="*"
ENV BUN_JSX_RUNTIME="haste"

# Hanya dependency runtime
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Sumber server
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY src/server ./src/server

# Aset SPA & Docs hasil build dari stage 1
COPY --from=client-builder /app/dist ./dist

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/health" || exit 1

CMD ["bun", "src/server/index.ts"]

