# @sit/web

S.I.T (Study In Tunisia) web client: React, TypeScript and Vite, styled with
Tailwind CSS v4.

## Development

From the repository root:

```bash
pnpm --filter @sit/web dev
```

The app runs at <http://localhost:5173>. Requests to `/api` are proxied to the
API (default `http://localhost:3000`); set `SIT_API_TARGET` to point the proxy at
another host.

## Scripts

- `pnpm --filter @sit/web dev` — development server
- `pnpm --filter @sit/web build` — typecheck and production build
- `pnpm --filter @sit/web lint` — ESLint
- `pnpm --filter @sit/web typecheck` — TypeScript project build
- `pnpm --filter @sit/web test` — Vitest (jsdom + Testing Library)

## Structure

- `src/api/` — typed client for the S.I.T API
- `src/auth/` — session persistence
- `src/components/` — application shell and shared UI primitives
- `src/pages/` — Landing, Login, Register, Profile and Documents
- `src/index.css` — Tailwind entry, design tokens and component primitives

## Design notes

The palette is defined in `src/index.css` (`@theme`): terracotta primary,
midnight secondary, and sand/sea accents. Light and dark themes are driven by
`<html data-theme="light|dark">`; the toggle lives in the header.
