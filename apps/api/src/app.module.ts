import { Module } from '@nestjs/common';
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
    HealthModule,
    PrismaModule,
    AccountModule,
    SessionModule,
    AuthModule,
    ConfirmationTokenModule,
    ProfileModule,
    UploadModule,
  ],
})
export class AppModule {}
