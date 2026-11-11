import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hookTimeout: 60000,
    // Argon2 operations are deliberately slow (64 MB memory, 3 passes)
    // and measured at 0.5-1.3 s each under parallel test load; several
    // integration tests chain multiple hashes/verifications, so the
    // default 5 s per-test timeout would produce flaky failures.
    testTimeout: 30000,
    // Stryker sandboxes (.stryker-tmp/) contain mutated copies of every
    // spec; they must never be collected by a normal `pnpm test` run.
    exclude: ['**/node_modules/**', '**/.stryker-tmp/**'],
    // Pin the reporter explicitly. Vitest 5 appends its `github-actions`
    // reporter whenever GITHUB_ACTIONS=true, and that reporter writes a
    // job summary on every run. Stryker executes this config once per
    // mutant, which flooded the mutation job's summary with dozens of
    // "Vitest Test Report" blocks. The root config governs `pnpm test`;
    // this pin governs Stryker's isolated runs.
    reporters: ['default'],
  },
});
