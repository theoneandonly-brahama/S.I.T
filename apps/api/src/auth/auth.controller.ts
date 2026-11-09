import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ChangeEmailDto } from './dto/change-email.dto.js';
import { JwtAuthGuard } from './guards/auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';

interface RequestUser {
  sub: string;
  email: string;
}

/**
 * AuthController exposes the authentication flow over HTTP:
 *
 *   POST /auth/register  — create an inactive account + confirmation token
 *   POST /auth/login     — authenticate a confirmed account + issue tokens
 *   POST /auth/refresh   — rotate refresh token, new access token
 *   POST /auth/logout    — revoke the session behind the refresh token
 *   POST /auth/change-password — change password (authenticated)
 *   POST /auth/change-email — change email with re-verification (authenticated)
 *
 * All endpoints delegate to AuthService. Token pairs are returned in the
 * response body; the refresh token is returned once and never logged.
 */
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  /**
   * Creates a new inactive account and its email-confirmation token.
   * No access or refresh token is issued until the address is confirmed.
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password);
  }

  /**
   * Authenticates credentials and issues an access + refresh token pair.
   * Returns 401 with a uniform message on any failure, including an
   * unverified account with a correct password (no enumeration).
   */
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const account = await this.authService.authenticate(
      dto.email,
      dto.password
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

  /**
   * Changes the authenticated account's password. Requires a valid
   * access token; the account id comes from the guard, never the body.
   * Returns 401 with the uniform message when the current password is
   * wrong or the account is unverified/banned, and 400 when the new
   * password violates policy.
   */
  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto
  ) {
    return this.authService.changePassword(
      dto.currentPassword,
      dto.newPassword,
      user.sub
    );
  }

  /**
   * Changes the authenticated account's email address. Requires a
   * valid access token; the account id comes from the guard, never
   * the body. The account email is updated immediately and a fresh
   * confirmation token is delivered to the NEW address (proving
   * ownership of the new inbox). The response is the generic
   * anti-enumeration message regardless of the address state.
   */
  @Post('change-email')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async changeEmail(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangeEmailDto
  ) {
    return this.authService.changeEmail(dto.newEmail, user.sub);
  }
}
