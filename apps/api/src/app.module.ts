import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AccountModule } from './account/account.module.js';
import { SessionModule } from './session/session.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfirmationTokenModule } from './confirmation-token/confirmation-token.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { UploadModule } from './upload/upload.module.js';

@Module({
  imports: [
    // Global IP rate limit. Production default is 10 req/min; the limit
    // is env-configurable so integration tests (which make far more than
    // 10 requests from one IP per route) can raise it via THROTTLE_LIMIT
    // in vitest.setup.ts without weakening the production posture.
    // Per-route limits (e.g. resend's 3/min) are unaffected.
    ThrottlerModule.forRoot([
      { ttl: 60000, limit: Number(process.env.THROTTLE_LIMIT) || 10 },
    ]),
    HealthModule,
    PrismaModule,
    AccountModule,
    SessionModule,
    AuthModule,
    ConfirmationTokenModule,
    ProfileModule,
    UploadModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
