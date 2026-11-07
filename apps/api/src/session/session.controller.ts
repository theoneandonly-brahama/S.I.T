import {
  Controller,
  Get,
  Delete,
  Param,
  Inject,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { SessionService } from './session.service.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

interface RequestUser {
  sub: string;
  email: string;
}

/**
 * SessionController exposes session management endpoints.
 *
 *   GET    /sessions      — list active sessions for the current user
 *   DELETE /sessions/:id  — revoke a specific session (ownership enforced)
 *   DELETE /sessions      — revoke all sessions for the current user
 *
 * All routes require a valid JWT access token (JwtAuthGuard).
 * Ownership is enforced: callers can only manage their own sessions.
 */
@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(
    @Inject(SessionService) private readonly sessionService: SessionService
  ) {}

  /**
   * Lists all non-revoked sessions for the authenticated account.
   * Returns session metadata (id, expiresAt, createdAt) — never the
   * hashed refresh token.
   */
  @Get()
  async list(@CurrentUser() user: RequestUser) {
    const sessions = await this.sessionService.findActiveByAccount(user.sub);
    return sessions.map((s) => ({
      id: s.id,
      accountId: s.accountId,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
    }));
  }

  /**
   * Revokes a specific session. Returns 404 if not found, 403 if the
   * session belongs to a different account.
   */
  @Delete(':id')
  async revoke(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    // Verify the session exists and belongs to the caller.
    const sessions = await this.sessionService.findActiveByAccount(user.sub);
    const owned = sessions.find((s) => s.id === id);
    if (!owned) {
      throw new NotFoundException('Session not found.');
    }

    const revoked = await this.sessionService.revoke(id);
    // Safe shape only — never expose refreshTokenHash.
    return {
      id: revoked.id,
      accountId: revoked.accountId,
      expiresAt: revoked.expiresAt,
      revokedAt: revoked.revokedAt,
      createdAt: revoked.createdAt,
    };
  }

  /**
   * Revokes all active sessions for the authenticated account.
   * Useful for "logout everywhere" or after a password change.
   */
  @Delete()
  async revokeAll(@CurrentUser() user: RequestUser) {
    return this.sessionService.revokeAllForAccount(user.sub);
  }
}
