# ─── ClanOfCodes Backend Dockerfile ──────────────────────────────────
#
# This image packages:
#   - Node.js 20 (API server + BullMQ worker)
#   - g++        (C++ compilation and execution)
#   - python3    (Python execution)
#
# Code submitted by users is compiled/executed DIRECTLY inside this
# container using child_process. No Docker daemon is needed at runtime.
# No nested containers are created.

FROM node:20-alpine

# ─── Install compiler toolchain ──────────────────────────────────────
RUN apk add --no-cache \
    g++ \
    python3 \
    py3-pip \
    && ln -sf python3 /usr/bin/python

# ─── Create a non-root user for running the app ──────────────────────
# Student code runs in the same process space, so we at least avoid
# running as root. This limits (but does not eliminate) potential damage.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# ─── Set working directory ───────────────────────────────────────────
WORKDIR /app

# ─── Install dependencies ────────────────────────────────────────────
# Copy package files first to leverage Docker layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# ─── Copy Prisma schema and generate client ──────────────────────────
COPY prisma ./prisma/
RUN npx prisma generate

# ─── Copy compiled TypeScript output ────────────────────────────────
# We copy the pre-built dist/ folder (built via `npm run build` in CI)
COPY dist ./dist/

# ─── Ensure /tmp is writable for job temp dirs ───────────────────────
RUN mkdir -p /tmp && chmod 1777 /tmp

# ─── Switch to non-root user ─────────────────────────────────────────
USER appuser

# ─── Expose API port ─────────────────────────────────────────────────
EXPOSE 5000

# ─── Start the server (worker is embedded inside server.ts) ──────────
CMD ["node", "dist/server.js"]
