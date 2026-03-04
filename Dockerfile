# Dockerfile
# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage build — keeps final image small (~120MB vs ~900MB)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only package files first (better layer cache — only reinstalls when deps change)
COPY package*.json ./
RUN npm install --omit=dev

# ── Stage 2: Final runtime image ─────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy deps from stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY server.js .
COPY package.json .

# Switch to non-root
USER appuser

EXPOSE 3001

# Health check so Docker/Portainer shows correct status
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "server.js"]