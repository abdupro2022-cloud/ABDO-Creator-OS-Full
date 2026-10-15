# Multi-stage Dockerfile for ABDO Creator OS.
# Stage 1: build everything. Stage 2: minimal runtime image.

FROM node:22-alpine AS builder
WORKDIR /app

# Install all dependencies (including dev for the build step)
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci --no-audit --no-fund

# Copy source
COPY shared ./shared
COPY server ./server
COPY client ./client
COPY tsconfig.json* ./
COPY .env.example ./

# Build
RUN npm run build:shared && \
    npm run build:server && \
    npm run build:client

# Prune dev deps for the runtime image
RUN npm prune --omit=dev

# ---- Runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Non-root user
RUN addgroup -S app && adduser -S app -G app
USER app

COPY --from=builder --chown=app:app /app/package.json /app/package-lock.json* ./
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/shared ./shared
COPY --from=builder --chown=app:app /app/server ./server
COPY --from=builder --chown=app:app /app/client ./client
COPY --from=builder --chown=app:app /app/.env.example ./

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["node", "server/dist/index.js"]
