# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable

# Copy workspace config and all package manifests from root context
COPY pnpm-lock.yaml ./pnpm-lock.yaml
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY package.json ./package.json

#----package manifests----
COPY apps/api/package.json ./apps/api/package.json
#COPY apps/web/package.json       ./apps/web/package.json
#COPY apps/mobile/package.json    ./apps/mobile/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/contract/package.json ./packages/contract/package.json

RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app


COPY --from=deps /app/ ./

# Copy API package manifest and source
COPY apps/api/ ./apps/api/
COPY packages/contract/ ./packages/contract/
COPY packages/config/ ./packages/config/

RUN pnpm --filter @sit/api build

# Stage 3 - production dependency closure for @sit/api only
FROM node:22-alpine AS prod-deps
RUN corepack enable
WORKDIR /app

COPY --from=deps /app/ ./
COPY --from=deps /root/.local/share/pnpm/store ./pnpm-store

RUN pnpm --store-dir ./pnpm-store --filter @sit/api --prod deploy /out


# Stage 4 - Runtime (non-root)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs


USER nestjs
COPY --from=prod-deps --chown=nestjs:nodejs /out/node_modules ./node_modules
COPY --from=builder   --chown=nestjs:nodejs /app/apps/api/dist ./dist


EXPOSE 3000
CMD ["node", "dist/main.js"]
