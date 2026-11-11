import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * Loads the repository-root `.env` into process.env for local development.
 *
 * The API has no configuration framework: every setting is read from
 * process.env at the point of use. Importing this module first in main.ts
 * makes `pnpm dev` work from a single `.env` file without shell exports.
 *
 * The path is resolved from this module rather than the working directory
 * because turbo runs each task with cwd=apps/api, while the file lives at
 * the repository root. A missing file is not an error: Docker images and
 * CI receive their configuration from the environment, and variables that
 * are already set are not overridden (the environment keeps precedence).
 */
const envFile = fileURLToPath(new URL('../../../../.env', import.meta.url));

if (existsSync(envFile)) {
  loadEnvFile(envFile);
}
