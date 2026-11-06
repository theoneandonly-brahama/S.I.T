import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    hookTimeout: 60000,
    // Package-specific test config goes here when needed.
    // Do NOT set `reporters` at package level — the root
    // vitest.config.ts governs the reporter for the whole workspace.
  },
});
