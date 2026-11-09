import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E for the web app (bonus Step 11, D-008 item 4).
 *
 * These tests drive a real browser against the REAL stack:
 *   - API: `docker compose -f infrastructure/docker-compose.yml up -d --build api`
 *     (or a locally running API on http://localhost:3000)
 *   - Web: started by the `webServer` block below (Vite dev, which
 *     proxies /api to the API) — or reuse an already-running dev server.
 *
 * They are NOT part of `pnpm test` (Vitest): run them separately with
 *   pnpm --filter @sit/web test:e2e
 * after installing browsers once:
 *   pnpm --filter @sit/web exec playwright install chromium
 *
 * Registration confirmation works in dev because the API returns the
 * token in the response (dev delivery seam, D-008 / item 24). Against
 * a production-mode API the confirm step cannot complete — same
 * limitation as manual testing.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: 'responsive.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      testMatch: 'responsive.spec.ts',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
