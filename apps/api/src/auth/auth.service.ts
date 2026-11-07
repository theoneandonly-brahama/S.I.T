import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { decode } from 'jsonwebtoken';
import argon2 from 'argon2';
import { AccountService } from '../account/account.service.js';
import { SessionService } from '../session/session.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

/**
 * AuthService performs credential validation with a uniform failure response,
 * and issues/rotates/revokes session tokens (E1-US1.d).
 *
 * Whether the account does not exist or the password is wrong, the caller
 * receives the same UnauthorizedException ("Invalid credentials.") — no
 * user-enumeration signal is leaked. When the account is missing, argon2
 * still runs against a dummy hash to mitigate timing differences.
 *
 * Access tokens are short-lived JWTs (15 minutes). Refresh tokens are JWTs
 * stored hashed in the Session table; they rotate on every refresh and are
 * revoked on logout.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(AccountService) private readonly accountService: AccountService,
    @Inject(SessionService) private readonly sessionService: SessionService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(TokenService) private readonly tokenService: TokenService
  ) {}

  /**
   * Authenticates an account by email and password.
   * Returns { id, email } on success; throws UnauthorizedException on failure.
   * The failure message is identical regardless of the failure reason.
   */
  async authenticate(email: string, password: string) {
    const account = await this.accountService.findByEmail(email);

    // Uniform failure: always run argon2 so timing doesn't reveal account existence.
    // The dummy input must satisfy the password policy (>=8 chars, letter,
    // digit) or PasswordService.hash would throw a 400 for unknown accounts,
    // leaking account existence through the status code.
    const hash =
      account?.passwordHash ??
      (await this.passwordService.hash('__dummy_account_123__'));
    const passwordMatches = account
      ? await this.passwordService.verify(password, hash)
      : false;

    if (!account || !passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return { id: account.id, email: account.email };
  }

  /**
   * Issues a new access + refresh token pair for an account.
   * Returns { accessToken, refreshToken, expiresIn }.
   * The refresh token is returned once (plaintext) and stored hashed in the
   * Session table; it can be rotated via refresh() or revoked via logout().
   */
  async login(
    accountId: string,
    email: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const accessToken = this.tokenService.signAccessToken({
      sub: accountId,
      email,
    });
    const refreshToken = this.tokenService.signRefreshToken({ sub: accountId });
    const refreshTokenHash = await argon2.hash(refreshToken);
    const expiresAt = new Date(
      Date.now() + Number(process.env.JWT_REFRESH_TTL || 604800) * 1000
    );

    await this.sessionService.create(accountId, refreshTokenHash, expiresAt);

    return {
      accessToken,
      refreshToken,
      expiresIn: Number(process.env.JWT_ACCESS_TTL || 900),
    };
  }

  /**
   * Rotates a refresh token: validates the presented refresh token, revokes
   * its session, and issues a new access + refresh token pair.
   * Returns { accessToken, refreshToken, expiresIn }.
   * Throws UnauthorizedException if the refresh token is invalid, revoked,
   * or expired.
   */
  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const decoded = decode(refreshToken) as { sub?: string } | null;
    if (!decoded?.sub) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const sessions = await this.sessionService.findActiveByAccount(decoded.sub);
    let matchedSession: {
      id: string;
      refreshTokenHash: string;
      expiresAt: Date;
      accountId: string;
    } | null = null;

    for (const session of sessions) {
      const matches = await argon2.verify(
        session.refreshTokenHash,
        refreshToken
      );
      if (matches) {
        matchedSession = session as {
          id: string;
          refreshTokenHash: string;
          expiresAt: Date;
          accountId: string;
        };
        break;
      }
    }

    if (!matchedSession) {
      throw new UnauthorizedException('Invalid or revoked refresh token.');
    }
    if (matchedSession.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired.');
    }

    // Rotate: revoke the old session.
    await this.sessionService.revoke(matchedSession.id);

    // Issue a new session with a new refresh token.
    const newRefreshToken = this.tokenService.signRefreshToken({
      sub: decoded.sub,
    });
    const newRefreshTokenHash = await argon2.hash(newRefreshToken);
    const newExpiresAt = new Date(
      Date.now() + Number(process.env.JWT_REFRESH_TTL || 604800) * 1000
    );

    await this.sessionService.create(
      decoded.sub,
      newRefreshTokenHash,
      newExpiresAt
    );

    const accessToken = this.tokenService.signAccessToken({
      sub: decoded.sub,
      email: '',
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: Number(process.env.JWT_ACCESS_TTL || 900),
    };
  }

  /**
   * Revokes the session associated with the presented refresh token
   * (logout). Throws UnauthorizedException if the token is invalid.
   */
  async logout(refreshToken: string): Promise<void> {
    const decoded = decode(refreshToken) as { sub?: string } | null;
    if (!decoded?.sub) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const sessions = await this.sessionService.findActiveByAccount(decoded.sub);
    let matchedSessionId: string | null = null;

    for (const session of sessions) {
      const matches = await argon2.verify(
        session.refreshTokenHash,
        refreshToken
      );
      if (matches) {
        matchedSessionId = session.id;
        break;
      }
    }

    if (!matchedSessionId) {
      throw new UnauthorizedException(
        'Invalid or already revoked refresh token.'
      );
    }

    await this.sessionService.revoke(matchedSessionId);
  }
}
