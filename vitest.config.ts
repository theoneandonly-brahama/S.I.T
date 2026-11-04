import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/*', 'packages/*'],
    // Explicitly set reporters to 'default' only.
    // Without this, Vitest auto-injects 'github-actions' in CI
    // and each project writes its own summary block.
    reporters: ['default'],
  },
});
