import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AccountModule } from '../account/account.module.js';
import { TokenModule } from '../auth/token.module.js';
import { SessionService } from './session.service.js';
import { SessionController } from './session.controller.js';

@Module({
  // AccountModule supplies AccountService and TokenModule supplies
  // TokenService for JwtAuthGuard. AuthModule must NOT be imported
  // here: AuthModule imports SessionModule, and a circular module
  // graph breaks under ESM evaluation order. AccountModule does not
  // import SessionModule, so this stays acyclic.
  imports: [PrismaModule, AccountModule, TokenModule],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
