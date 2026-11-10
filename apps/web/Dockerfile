# S.I.T web — production image (build with pnpm, serve with nginx).
#
# Build context is the REPOSITORY ROOT (same as the API image) because
# the web app imports @sit/contract from the workspace:
#   docker build -f apps/web/Dockerfile -t sit-web .
#
# nginx serves the Vite SPA and reverse-proxies /api/ to the API
# service on the Compose network (api:3000), mirroring the Vite dev
# proxy (which also strips the /api prefix — the API serves at root).
#
# The server runs as the unprivileged `nginx` user: a static SPA plus
# a reverse proxy needs no root. That is why the main config listens
# on 8080 and keeps its pid/temp files under /tmp (see nginx.conf).

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
FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10 AS runner

# Full main config (not just a conf.d snippet): a non-root worker
# cannot bind :80 or write the default pid/temp paths, so this file
# sets listen 8080, pid /tmp/nginx.pid and /tmp temp paths.
COPY apps/web/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
