import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TokenModule } from '../auth/token.module.js';
import { SessionService } from './session.service.js';
import { SessionController } from './session.controller.js';

@Module({
  // TokenModule supplies TokenService for JwtAuthGuard. AuthModule must
  // NOT be imported here: AuthModule imports SessionModule, and a
  // circular module graph breaks under ESM evaluation order.
  imports: [PrismaModule, TokenModule],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
