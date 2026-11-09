import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * The web project runs in a DOM environment so tests can render the
 * real components instead of only importing them.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Playwright E2E lives in ./e2e and runs via `test:e2e`, never Vitest.
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
});
