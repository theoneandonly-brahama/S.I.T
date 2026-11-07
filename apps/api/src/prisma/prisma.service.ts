import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * PrismaService wraps PrismaClient with NestJS lifecycle hooks.
 *
 * Prisma 7 requires an explicit driver adapter to connect — the client
 * no longer resolves a datasource from environment variables on its own.
 * PrismaPg wraps node-postgres and receives DATABASE_URL here, failing
 * fast (at construction) when the variable is missing instead of
 * attempting a silent localhost connection.
 *
 * Connects to PostgreSQL when the module initializes and disconnects
 * when the application shuts down, preventing leaked connections.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL environment variable is not set — Prisma cannot connect.'
      );
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
