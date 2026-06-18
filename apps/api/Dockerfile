# ============================================================
# SC Office API - Multi-stage Dockerfile
# ============================================================

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ============================================================
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

# ============================================================
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
EXPOSE 3001
CMD ["pnpm", "dev"]

# ============================================================
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build

# ============================================================
FROM base AS production
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY package.json tsconfig.json ./

# Puppeteer dependencies
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

USER nestjs
EXPOSE 3001
CMD ["node", "dist/main"]
