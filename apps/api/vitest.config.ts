import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    hookTimeout: 60000,
    // Argon2 operations are deliberately slow (64 MB memory, 3 passes)
    // and measured at 0.5-1.3 s each under parallel test load; several
    // integration tests chain multiple hashes/verifications, so the
    // default 5 s per-test timeout would produce flaky failures.
    testTimeout: 30000,
    // Package-specific test config goes here when needed.
    // Do NOT set `reporters` at package level — the root
    // vitest.config.ts governs the reporter for the whole workspace.
  },
});
