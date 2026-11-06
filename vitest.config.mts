import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/*', 'packages/*'],
    reporters: ['default', 'junit'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['apps/api/src/**/*.ts'],
      exclude: ['**/*.spec.ts', '**/*.integration.spec.ts', 'apps/api/src/main.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    outputFile: {
      junit: './junit.xml',
    },
  },
});
