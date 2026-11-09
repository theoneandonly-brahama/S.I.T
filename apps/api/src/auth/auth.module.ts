import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module.js';
import { SessionModule } from '../session/session.module.js';
import { ConfirmationTokenModule } from '../confirmation-token/confirmation-token.module.js';
import { TokenModule } from './token.module.js';
import { PasswordService } from './password.service.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';

@Module({
  // TokenModule (not AuthModule) is what guarded feature modules import
  // for TokenService — importing AuthModule from AccountModule or
  // SessionModule would create a circular module graph.
  // ConfirmationTokenModule supplies ConfirmationTokenService for the
  // registration use case; it does not import AuthModule, so no cycle.
  imports: [AccountModule, SessionModule, TokenModule, ConfirmationTokenModule],
  controllers: [AuthController],
  providers: [PasswordService, AuthService],
  exports: [PasswordService, AuthService],
})
export class AuthModule {}
