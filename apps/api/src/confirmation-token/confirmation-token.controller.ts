import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  Inject,
  UseGuards,
} from '@nestjs/common';
import { ConfirmationTokenService } from './confirmation-token.service.js';
import { AccountService } from '../account/account.service.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CreateTokenDto } from './dto/create-token.dto.js';
import { VerifyTokenDto } from './dto/verify-token.dto.js';

interface RequestUser {
  sub: string;
  email: string;
}

/**
 * ConfirmationTokenController exposes email confirmation endpoints.
 *
 *   POST /confirmation-token        — create a token for the current user
 *   GET  /confirmation-token/verify — verify a token (query param)
 *
 * The verify endpoint is public (no auth guard) because the user may
 * not be logged in yet — they click the link from their email.
 */
@Controller('confirmation-token')
export class ConfirmationTokenController {
  constructor(
    @Inject(ConfirmationTokenService)
    private readonly tokenService: ConfirmationTokenService,
    @Inject(AccountService) private readonly accountService: AccountService,
  ) {}

  /**
   * Creates a confirmation token for the authenticated account.
   * Returns the plaintext token (shown once, e.g. in dev mode) and the
   * expiry timestamp. In production this would be emailed to the user.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTokenDto,
  ) {
    // dto is accepted for extensibility (e.g. resending to a new email)
    // but currently unused — the token is always for the authenticated account.
    void dto;
    return this.tokenService.create(user.sub);
  }

  /**
   * Verifies a confirmation token from the query string and marks the
   * account as email-verified. Public endpoint — no auth guard.
   *
   * Query params:
   *   token — the plaintext confirmation token
   *
   * Returns 200 with { verified: true } on success.
   * Returns 401 if the token is invalid or expired.
   */
  @Get('verify')
  async verify(@Query() dto: VerifyTokenDto) {
    const record = await this.tokenService.verify(dto.token);

    // Consume the token (single-use) and mark the account verified.
    await this.tokenService.consume(record.id);
    await this.accountService.markVerified(record.accountId);

    return { verified: true };
  }
}
