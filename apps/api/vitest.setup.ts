// Sprint 2 Testcontainers setup.
// Spins up a real `postgres:16-alpine` container before the test suite and
// sets DATABASE_URL so PrismaClient can connect. Migrations are applied by
// individual integration tests or via `prisma migrate deploy` separately.
// Stopped after the suite finishes.

import { beforeAll, afterAll } from 'vitest';
import { GenericContainer, Wait } from 'testcontainers';

let container: Awaited<ReturnType<GenericContainer.prototype.start>> | null = null;

beforeAll(async () => {
  container = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({
      POSTGRES_USER: 'sit',
      POSTGRES_PASSWORD: 'sit_password',
      POSTGRES_DB: 'sit_test',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections'))
    .start();

  const port = container.getMappedPort(5432);
  process.env.DATABASE_URL = `postgresql://sit:sit_password@localhost:${port}/sit_test?schema=public`;
});

afterAll(async () => {
  if (container) {
    await container.stop();
    container = null;
  }
});
