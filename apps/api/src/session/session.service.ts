import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SessionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Creates a new session for an account. The refresh token is stored
   * hashed (never plaintext) — callers must pass the hash produced by
   * the token service in Step 3/Step 5.
   */
  async create(accountId: string, refreshTokenHash: string, expiresAt: Date) {
    return this.prisma.session.create({
      data: { accountId, refreshTokenHash, expiresAt },
    });
  }

  /** Looks up a session by its hashed refresh token. */
  async findByRefreshTokenHash(refreshTokenHash: string) {
    return this.prisma.session.findUnique({ where: { refreshTokenHash } });
  }

  /** Revokes a single session (logout). */
  async revoke(id: string) {
    const session = await this.prisma.session.findUnique({ where: { id } });
    if (!session) {
      throw new NotFoundException('Session not found.');
    }
    return this.prisma.session.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /** Revokes all active sessions for an account (logout everywhere / ban cleanup). */
  async revokeAllForAccount(accountId: string) {
    return this.prisma.session.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Lists all non-revoked sessions for an account. */
  async findActiveByAccount(accountId: string) {
    return this.prisma.session.findMany({
      where: { accountId, revokedAt: null },
    });
  }
}
