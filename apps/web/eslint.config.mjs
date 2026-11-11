import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Same family and shape as apps/api and packages/*: flat config,
// recommended rules only, no rule disabling. The bundler entry
// (vite.config.ts) is not part of the linted source surface.
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'eslint.config.mjs',
      'vite.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.tsx', 'src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
  }
);
