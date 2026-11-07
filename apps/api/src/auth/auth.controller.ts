import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { AccountService } from '../account/account.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RegisterDto } from './dto/register.dto.js';

/**
 * AuthController exposes the authentication flow over HTTP:
 *
 *   POST /auth/register  — create account + issue tokens
 *   POST /auth/login     — authenticate + issue tokens
 *   POST /auth/refresh   — rotate refresh token, new access token
 *   POST /auth/logout    — revoke the session behind the refresh token
 *
 * All endpoints delegate to AuthService / AccountService / PasswordService.
 * Token pairs are returned in the response body; the refresh token is
 * returned once and never logged.
 */
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AccountService) private readonly accountService: AccountService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
  ) {}

  /**
   * Creates a new account with a hashed password and immediately issues
   * an access + refresh token pair (auto-login on register).
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const passwordHash = await this.passwordService.hash(dto.password);
    const account = await this.accountService.create(
      dto.email,
      passwordHash,
    );

    const tokens = await this.authService.login(account.id, account.email);

    return {
      account,
      ...tokens,
    };
  }

  /**
   * Authenticates credentials and issues an access + refresh token pair.
   * Returns 401 with a uniform message on any failure (no enumeration).
   */
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const account = await this.authService.authenticate(
      dto.email,
      dto.password,
    );

    const tokens = await this.authService.login(account.id, account.email);

    return tokens;
  }

  /**
   * Rotates the refresh token and issues a new access + refresh pair.
   * Returns 401 if the refresh token is invalid, revoked, or expired.
   */
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto) {
    try {
      return await this.authService.refresh(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }
  }

  /**
   * Revokes the session behind the presented refresh token (logout).
   * Always returns 204 regardless of token validity to avoid leaking
   * whether a token was valid.
   */
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto) {
    try {
      await this.authService.logout(dto.refreshToken);
    } catch {
      // Silently ignore — logout is idempotent.
    }
  }
}
