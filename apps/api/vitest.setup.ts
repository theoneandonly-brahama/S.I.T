// Sprint 2 Testcontainers setup.
// Spins up a real `postgres:16-alpine` container before each test file,
// sets DATABASE_URL so PrismaClient (via the PrismaPg driver adapter)
// can connect, then applies all migrations with `prisma migrate deploy`.
// Stopped after the suite finishes.

import { beforeAll, afterAll } from 'vitest';
import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from 'testcontainers';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

let container: StartedTestContainer | null = null;

beforeAll(async () => {
  container = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({
      POSTGRES_USER: 'sit',
      POSTGRES_PASSWORD: 'sit_password',
      POSTGRES_DB: 'sit_test',
    })
    .withExposedPorts(5432)
    // Two conditions must BOTH hold before migrations run (the composite
    // strategy resolves when every child strategy has completed):
    //
    // 1. Log occurrence x2: Postgres prints "ready to accept connections"
    //    twice on a fresh initdb — first from initdb's temporary server
    //    (which never listens on TCP), then from the real server. Waiting
    //    for only the first occurrence returns before the database is
    //    reachable, letting `prisma migrate deploy` race startup and fail
    //    with "the database system is starting up". A pre-existing data
    //    directory would log only once, but this container is always
    //    fresh (no volume).
    // 2. Listening ports: on Windows/macOS Docker runs a user-side port
    //    proxy, so the host port can lag behind container readiness —
    //    the source of P1001 "Can't reach database server" failures when
    //    many test files start containers in parallel.
    .withWaitStrategy(
      Wait.forAll([
        Wait.forLogMessage('database system is ready to accept connections', 2),
        Wait.forListeningPorts(),
      ])
    )
    .start();

  const port = container.getMappedPort(5432);
  process.env.DATABASE_URL = `postgresql://sit:sit_password@localhost:${port}/sit_test?schema=public`;

  // Apply migrations against the fresh container. The API package root is
  // resolved from the current directory because vitest may run either from
  // the workspace root (`pnpm test`) or from apps/api.
  const apiRoot = existsSync('prisma.config.ts')
    ? process.cwd()
    : join(process.cwd(), 'apps', 'api');

  // Short retry around the migrate step. The wait strategy above already
  // gates on server readiness, but many parallel `prisma migrate deploy`
  // processes can still collide briefly under Docker Desktop load.
  // `migrate deploy` is idempotent (each migration runs in its own
  // transaction and is recorded once), so retrying is safe; a persistent
  // failure still fails setup after the last attempt.
  let migrateError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      execSync('pnpm exec prisma migrate deploy', {
        cwd: apiRoot,
        stdio: 'inherit',
      });
      migrateError = undefined;
      break;
    } catch (error) {
      migrateError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
  if (migrateError) {
    throw migrateError;
  }
}, 120_000);

afterAll(async () => {
  if (container) {
    await container.stop();
    container = null;
  }
});
