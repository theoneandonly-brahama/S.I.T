import {
  Controller,
  Get,
  Patch,
  Body,
  Inject,
  UseGuards,
} from '@nestjs/common';
import { AccountService } from './account.service.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';

interface RequestUser {
  sub: string;
  email: string;
}

/**
 * AccountController exposes account management endpoints.
 *
 *   GET  /accounts/me  — return the authenticated account (safe fields only)
 *   PATCH /accounts/me — reserved for future patchable fields; email and
 *                        password changes have dedicated auth endpoints
 *                        (POST /auth/change-email, POST /auth/change-password)
 *                        so they cannot bypass re-verification
 *
 * All routes require a valid JWT access token (JwtAuthGuard).
 * Ownership is implicit: the account is looked up by `user.sub` from
 * the decoded token, so callers can only modify their own record.
 */
@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(
    @Inject(AccountService) private readonly accountService: AccountService
  ) {}

  /**
   * Returns the authenticated account's safe representation.
   * passwordHash is never exposed (AccountService.toResponse strips it).
   */
  @Get('me')
  async getMe(@CurrentUser() user: RequestUser) {
    return this.accountService.findById(user.sub);
  }

  /**
   * Updates the authenticated account. No fields are patchable in
   * Release 1 (see UpdateAccountDto): email changes go through
   * POST /auth/change-email and password changes through
   * POST /auth/change-password, both of which enforce their own
   * verification flow.
   */
  @Patch('me')
  async updateMe(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateAccountDto
  ) {
    return this.accountService.update(user.sub, dto);
  }
}
