import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  Inject,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfirmationTokenService } from './confirmation-token.service.js';
import { ConfirmationDeliveryService } from './confirmation-delivery.service.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CreateTokenDto } from './dto/create-token.dto.js';
import { ResendTokenDto } from './dto/resend-token.dto.js';
import { VerifyTokenDto } from './dto/verify-token.dto.js';

interface RequestUser {
  sub: string;
  email: string;
}

const RESEND_MESSAGE =
  'If an unverified account exists for this address, a confirmation token has been issued.';

/**
 * ConfirmationTokenController exposes email confirmation endpoints.
 *
 *   POST /confirmation-token        — create a token for the current user
 *   POST /confirmation-token/resend — public resend for an unverified account
 *   GET  /confirmation-token/verify — verify a token (query param)
 *
 * The verify and resend endpoints are public (no auth guard) because the
 * user may not be logged in yet.
 */
@Controller('confirmation-token')
export class ConfirmationTokenController {
  constructor(
    @Inject(ConfirmationTokenService)
    private readonly tokenService: ConfirmationTokenService,
    @Inject(ConfirmationDeliveryService)
    private readonly deliveryService: ConfirmationDeliveryService
  ) {}

  /**
   * Creates a confirmation token for the authenticated account.
   * Returns the plaintext token (shown once) and the expiry timestamp.
   * The public resend endpoint uses the delivery service instead.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateTokenDto) {
    // dto is accepted for extensibility (e.g. resending to a new email)
    // but currently unused — the token is always for the authenticated account.
    void dto;
    return this.tokenService.create(user.sub);
  }

  /**
   * Public resend endpoint. Always returns the same generic message, whether
   * the address is unknown, already verified, or unverified. A token is
   * issued and delivered only for an unverified account.
   */
  @Post('resend')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async resend(@Body() dto: ResendTokenDto) {
    const confirmation = await this.tokenService.resend(dto.email);

    if (confirmation) {
      await this.deliveryService.deliver(dto.email, confirmation.token);
    }

    return { message: RESEND_MESSAGE };
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
    // Consume the token and mark the account verified atomically —
    // a failure mid-way cannot burn the token while leaving the
    // account unverified.
    await this.tokenService.verifyAndMarkVerified(dto.token);

    return { verified: true };
  }
}
