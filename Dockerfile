FROM node:20-alpine AS base

# Install minimal libs; sharp needs libc6-compat on Alpine
RUN apk add --no-cache libc6-compat wget

ENV NODE_ENV=production \
    PORT=3002 \
    MARKET_PORT=3002

WORKDIR /app

# Copy package manifests
COPY --chown=node:node package.json package-lock.json* ./

# Install production deps
RUN npm ci --omit=dev || npm i --omit=dev

# Copy app source
COPY --chown=node:node . .

# Switch to non-root user
USER node

EXPOSE 3002

# Healthcheck hits /healthz
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:${PORT}/healthz || exit 1

CMD ["node", "server.js"]