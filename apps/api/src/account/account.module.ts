import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TokenModule } from '../auth/token.module.js';
import { AccountService } from './account.service.js';
import { AccountController } from './account.controller.js';

@Module({
  // TokenModule supplies TokenService for JwtAuthGuard. AuthModule must
  // NOT be imported here: AuthModule imports AccountModule, and a
  // circular module graph breaks under ESM evaluation order.
  imports: [PrismaModule, TokenModule],
  controllers: [AccountController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
