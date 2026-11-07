import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module.js';
import { SessionModule } from '../session/session.module.js';
import { TokenModule } from './token.module.js';
import { PasswordService } from './password.service.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';

@Module({
  // TokenModule (not AuthModule) is what guarded feature modules import
  // for TokenService — importing AuthModule from AccountModule or
  // SessionModule would create a circular module graph.
  imports: [AccountModule, SessionModule, TokenModule],
  controllers: [AuthController],
  providers: [PasswordService, AuthService],
  exports: [PasswordService, AuthService],
})
export class AuthModule {}
