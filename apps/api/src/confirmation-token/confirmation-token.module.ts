import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TokenModule } from '../auth/token.module.js';
import { ConfirmationTokenService } from './confirmation-token.service.js';
import { ConfirmationTokenController } from './confirmation-token.controller.js';
import { AccountModule } from '../account/account.module.js';

@Module({
  // AccountModule for AccountService (mark-verified), TokenModule for
  // JwtAuthGuard — AuthModule itself is not needed, and importing it
  // would risk a circular graph.
  imports: [PrismaModule, AccountModule, TokenModule],
  controllers: [ConfirmationTokenController],
  providers: [ConfirmationTokenService],
  exports: [ConfirmationTokenService],
})
export class ConfirmationTokenModule {}
