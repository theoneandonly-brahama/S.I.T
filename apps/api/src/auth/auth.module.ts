import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module.js';
import { SessionModule } from '../session/session.module.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [AccountModule, SessionModule],
  providers: [PasswordService, TokenService, AuthService],
  exports: [PasswordService, TokenService, AuthService],
})
export class AuthModule {}
