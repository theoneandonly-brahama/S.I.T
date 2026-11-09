# Stage 1: Dependencies
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable

# Copy workspace config and all package manifests from root context
COPY pnpm-lock.yaml ./pnpm-lock.yaml
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY package.json ./package.json
COPY .npmrc ./.npmrc

#----package manifests----
COPY apps/api/package.json ./apps/api/package.json
#COPY apps/web/package.json       ./apps/web/package.json
#COPY apps/mobile/package.json    ./apps/mobile/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/contract/package.json ./packages/contract/package.json

RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS builder
RUN corepack enable
WORKDIR /app

COPY --from=deps /app/ ./

# Copy API package manifest and source
COPY apps/api/ ./apps/api/
COPY packages/contract/ ./packages/contract/
COPY packages/config/ ./packages/config/

RUN DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy pnpm --filter @sit/api exec prisma generate
# Force a clean, non-incremental emit. A copied tsconfig.tsbuildinfo makes
# tsc skip re-emitting unchanged files into the empty dist/ directory,
# producing an image whose dist is missing modules at runtime.
RUN rm -f apps/api/tsconfig.tsbuildinfo && rm -rf apps/api/dist
RUN pnpm --filter @sit/api build

# Stage 3 - production dependency closure for @sit/api only
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS prod-deps
RUN corepack enable
WORKDIR /app

COPY --from=deps /app/ ./
COPY --from=deps /root/.local/share/pnpm/store ./pnpm-store

RUN pnpm --store-dir ./pnpm-store --filter @sit/api --prod deploy --legacy /out

# Prisma runtime generation inside the pruned tree:
# - `@prisma/client` is a prod dependency, but the pruned /out does NOT ship
#   the `prisma` CLI's generated `.prisma` runtime files (deploy re-links
#   from the immutable content store, which never contains generated files).
# - Generation therefore runs here, with cwd=/out so the client output
#   resolves inside the deployed tree. DATABASE_URL is only a throwaway
#   literal for Prisma 7 config validation (generate does not connect).
# - The `prisma` CLI itself IS in the prod closure (runtime dependency
#   for `migrate deploy` at container start — see CMD below).
COPY apps/api/prisma /out/prisma
COPY apps/api/prisma.config.ts /out/prisma.config.ts
RUN cd /out && \
    DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy \
    /app/apps/api/node_modules/.bin/prisma generate --schema=prisma/schema.prisma


# Stage 4 - Runtime (non-root)
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
# UploadService creates this directory at construction time. /app is owned
# by root, so the non-root runtime user cannot mkdir it at startup.
RUN mkdir -p /app/uploads && chown nestjs:nodejs /app/uploads

USER nestjs
COPY --from=prod-deps --chown=nestjs:nodejs /out/node_modules ./node_modules
COPY --from=builder   --chown=nestjs:nodejs /app/apps/api/dist ./dist

EXPOSE 3000
# Apply database migrations before starting the API: fresh Compose
# volumes have no tables, and the app itself does not migrate on boot.
# The Prisma CLI ships in the prod closure (prisma is a runtime
# dependency for exactly this reason); DATABASE_URL comes from the
# Compose environment.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
