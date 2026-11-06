import {
  Injectable,
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
 * single-use (consumedAt marks consumption). Only one unused token may
 * exist per account at a time — creating a new one revokes any prior
 * unused token for the same account.
 */
@Injectable()
export class ConfirmationTokenService {
  private static readonly TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a confirmation token for an account, stores it hashed with
   * a 24-hour expiry, and returns the plaintext token (shown only once,
   * e.g. emailed to the user). Any previous unused token for the same
   * account is revoked so only one active confirmation token exists.
   */
  async create(accountId: string): Promise<{ token: string; expiresAt: Date }> {
    // Revoke any existing unused confirmation token for this account.
    await this.prisma.confirmationToken.updateMany({
      where: { accountId, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    const tokenHash = await argon2.hash(token);
    const expiresAt = new Date(
      Date.now() + ConfirmationTokenService.TOKEN_TTL_MS
    );

    await this.prisma.confirmationToken.create({
      data: {
        accountId,
        tokenHash,
        expiresAt,
        consumedAt: null,
      },
    });

    return { token, expiresAt };
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
