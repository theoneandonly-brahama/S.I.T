import {
  Injectable,
  Inject,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * ConfirmationTokenService manages email confirmation tokens (E1-US1.c).
 *
 * Tokens are random, expirable (24-hour validity), stored hashed, and
 * single-use (consumedAt marks consumption). The schema keeps one token
 * row per account; reissuing overwrites that row, so only the latest
 * plaintext token can be verified.
 */
@Injectable()
export class ConfirmationTokenService {
  private static readonly TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Generates a confirmation token for an account, stores it hashed with
   * a 24-hour expiry, and returns the plaintext token (shown only once,
   * e.g. emailed to the user).
   *
   * accountId is unique, so the row is upserted: overwriting tokenHash
   * invalidates any previously issued token, and clearing consumedAt
   * makes the new token usable even when the previous one was consumed.
   */
  async create(accountId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = await argon2.hash(token);
    const expiresAt = new Date(
      Date.now() + ConfirmationTokenService.TOKEN_TTL_MS
    );

    await this.prisma.confirmationToken.upsert({
      where: { accountId },
      update: { tokenHash, expiresAt, consumedAt: null },
      create: { accountId, tokenHash, expiresAt, consumedAt: null },
    });

    return { token, expiresAt };
  }

  /**
   * Issues a fresh token only for an unverified account.
   *
   * Returns null for an unknown or already-verified address. The no-op path
   * still performs one argon2 hash so the response time does not trivially
   * reveal whether the account exists.
   */
  async resend(
    email: string
  ): Promise<{ token: string; expiresAt: Date } | null> {
    const account = await this.prisma.account.findUnique({ where: { email } });

    if (!account || account.isVerified) {
      await argon2.hash(randomBytes(32).toString('hex'));
      return null;
    }

    return this.create(account.id);
  }

  /**
   * Verifies a plaintext confirmation token against all valid
   * (non-consumed, non-expired) stored hashes. Returns the matching
   * token record if valid; throws UnauthorizedException otherwise.
   */
  async verify(token: string) {
    const now = new Date();
    const validTokens = await this.prisma.confirmationToken.findMany({
      where: {
        consumedAt: null,
        expiresAt: { gt: now },
      },
    });

    for (const record of validTokens) {
      const matches = await argon2.verify(record.tokenHash, token);
      if (matches) {
        return record;
      }
    }

    throw new UnauthorizedException('Invalid or expired confirmation token.');
  }

  /**
   * Marks a confirmation token as consumed (single use). Called after a
   * successful verification so the token cannot be reused.
   */
  async consume(id: string) {
    const record = await this.prisma.confirmationToken.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException('Confirmation token not found.');
    }
    if (record.consumedAt) {
      throw new UnauthorizedException('Confirmation token already consumed.');
    }
    return this.prisma.confirmationToken.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }

  /**
   * Verifies a token, consumes it, and marks the account verified —
   * atomically. The consume and the mark-verified write run in a single
   * database transaction, so a failure between them cannot burn the
   * token while leaving the account unverified (the old non-atomic
   * controller sequence). Throws UnauthorizedException for an invalid
   * or expired token, before any write.
   */
  async verifyAndMarkVerified(token: string) {
    const record = await this.verify(token);

    await this.prisma.$transaction(async (tx) => {
      await tx.confirmationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
      await tx.account.update({
        where: { id: record.accountId },
        data: { isVerified: true },
      });
    });

    return record;
  }

  /**
   * Deletes expired, unconsumed confirmation tokens. Intended for
   * periodic maintenance (cron or startup cleanup).
   */
  async cleanupExpired() {
    const now = new Date();
    return this.prisma.confirmationToken.deleteMany({
      where: {
        expiresAt: { lt: now },
        consumedAt: null,
      },
    });
  }

  /**
   * Finds the active (non-consumed, non-expired) confirmation token for
   * an account, if one exists.
   */
  async findValidByAccount(accountId: string) {
    const now = new Date();
    return this.prisma.confirmationToken.findFirst({
      where: {
        accountId,
        consumedAt: null,
        expiresAt: { gt: now },
      },
    });
  }
}
