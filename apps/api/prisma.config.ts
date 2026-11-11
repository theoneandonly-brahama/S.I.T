import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig, env } from 'prisma/config';

// The Prisma CLI does not read the repository .env on its own (Prisma 7
// resolves the datasource through this file). Load it here so
// `pnpm --filter @sit/api exec prisma migrate deploy` works without
// exporting DATABASE_URL. The environment still wins, and a missing file
// (Docker image, CI) is ignored.
const envFile = fileURLToPath(new URL('../../.env', import.meta.url));

if (existsSync(envFile)) {
  loadEnvFile(envFile);
}

export default defineConfig({
  datasource: {
    url: env('DATABASE_URL'),
  },
});
