# S.I.T web — production image (build with pnpm, serve with nginx).
#
# Build context is the REPOSITORY ROOT (same as the API image) because
# the web app imports @sit/contract from the workspace:
#   docker build -f apps/web/Dockerfile -t sit-web .
#
# nginx serves the Vite SPA and reverse-proxies /api/ to the API
# service on the Compose network (api:3000), mirroring the Vite dev
# proxy (which also strips the /api prefix — the API serves at root).

# ---- Stage 1: install ----
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml ./pnpm-lock.yaml
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY package.json ./package.json
COPY .npmrc ./.npmrc
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contract/package.json ./packages/contract/package.json
COPY packages/config/package.json ./packages/config/package.json

RUN pnpm install --frozen-lockfile

# ---- Stage 2: build ----
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS builder
RUN corepack enable
WORKDIR /app

COPY --from=deps /app/ ./
COPY apps/web/ ./apps/web/
COPY packages/contract/ ./packages/contract/
COPY packages/config/ ./packages/config/

# The web typecheck/build consumes @sit/contract's compiled dist, so
# the contract must be built first (same note as the local runbook).
RUN pnpm --filter @sit/contract build
RUN pnpm --filter @sit/web build

# ---- Stage 3: serve ----
FROM nginx:1.27-alpine@sha256:656ce47a34be5d8ff2f8a314d614e3d97a3a32a154fe5a803f3a66fe8b8d03615 AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
