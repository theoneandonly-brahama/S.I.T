import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { decode } from 'jsonwebtoken';
import argon2 from 'argon2';
import { AccountService } from '../account/account.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SessionService } from '../session/session.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { ConfirmationTokenService } from '../confirmation-token/confirmation-token.service.js';
import { ConfirmationDeliveryService } from '../confirmation-token/confirmation-delivery.service.js';

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
 *
 * E1-US1: session and account settings endpoints — password change, email
 * change with re-verification, and richer session metadata.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(AccountService) private readonly accountService: AccountService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SessionService) private readonly sessionService: SessionService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(ConfirmationTokenService)
    private readonly confirmationTokenService: ConfirmationTokenService,
    @Inject(ConfirmationDeliveryService)
    private readonly confirmationDeliveryService: ConfirmationDeliveryService
  ) {}

  /**
   * Authenticates an account by email and password.
   * Returns { id, email } on success; throws UnauthorizedException on failure.
   * The failure message is identical regardless of the failure reason,
   * including an unverified account with a correct password.
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

    if (!account.isVerified) {
      // Same response as invalid credentials: do not confirm that a valid
      // credential pair belongs to an account that has not been activated.
      throw new UnauthorizedException('Invalid credentials.');
    }

    return { id: account.id, email: account.email };
  }

  /**
   * E1-US1: registers an inactive account and creates its email-confirmation token.
   *
   * No session is issued here: E1-US1 requires the address to be confirmed
   * before login. The plaintext token is returned for the development
   * delivery path; a production adapter must email it instead and return only
   * a generic acknowledgement.
   *
   * Anti-enumeration: the response is identical whether the address already
   * exists or not — no 409 is ever returned. If the account already exists,
   * it is reused so the confirmation token is simply re-issued.
   */
  async register(
    email: string,
    password: string
  ): Promise<{
    account: {
      id: string;
      email: string;
      isVerified: boolean;
    };
    confirmation: {
      token: string;
      expiresAt: Date;
    };
  }> {
    const passwordHash = await this.passwordService.hash(password);

    // E1-US1 anti-enumeration: always return the same shape regardless of
    // whether the address already exists. Reuse existing account if present.
    const existing = await this.accountService.findByEmail(email);
    const account = existing ?? await this.accountService.create(email, passwordHash);

    const confirmation = await this.confirmationTokenService.create(account.id);

    return { account, confirmation };
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

    const account = await this.prisma.account.findUnique({
      where: { id: decoded.sub },
    });

    // Unverified accounts cannot rotate tokens: a pre-existing session
    // must not survive the account becoming unverified (e.g. after an
    // email change). Same uniform 401 as every other auth failure.
    if (!account || !account.isVerified || account.isBanned) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    // Revoke the old session.
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
      throw new UnauthorizedException('Invalid or revoked refresh token.');
    }

    await this.sessionService.revoke(matchedSessionId);

    // Issue a new access token.
    const accessToken = this.tokenService.signAccessToken({
      sub: account.id,
      email: account.email,
    });

    // Issue a new refresh token.
    const newRefreshToken = this.tokenService.signRefreshToken({
      sub: account.id,
    });
    const newRefreshTokenHash = await argon2.hash(newRefreshToken);
    const newExpiresAt = new Date(
      Date.now() + Number(process.env.JWT_REFRESH_TTL || 604800) * 1000
    );

    await this.sessionService.create(account.id, newRefreshTokenHash, newExpiresAt);

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

  /**
   * Changes the user's password.
   *
   * Requires the user to be authenticated (caller must have a valid access
   * token via the JwtAuthGuard). Validates the current password against the
   * stored hash, hashes the new password with argon2id, and updates the
   * account's password hash in the database.
   *
   * @param currentPassword - The user's current password
   * @param newPassword - The new password (must meet policy: >=8 chars,
 *   at least one letter, one digit)
 * @param userId - The authenticated account ID (passed from the guard)
 * @returns { success: true } on success
 * @throws { UnauthorizedException } if the current password is incorrect
 *   or the account is not verified / is banned
 * @throws { BadRequestException } if the new password doesn't meet policy
 */
  async changePassword(
    currentPassword: string,
    newPassword: string,
    userId: string
  ): Promise<{ success: boolean }> {
    // Get the current authenticated account.
    const account = await this.prisma.account.findUnique({
      where: { id: userId },
    });

    if (!account) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (!account.isVerified) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (account.isBanned) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    // Verify the current password.
    const passwordMatches = await this.passwordService.verify(
      currentPassword,
      account.passwordHash
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    // Validate the new password policy.
    this.passwordService.validatePassword(newPassword);

    // Hash the new password.
    const newHash = await this.passwordService.hash(newPassword);

    // Update the account's password hash in the database.
    await this.prisma.account.update({
      where: { id: account.id },
      data: { passwordHash: newHash }
    });

    return { success: true };
  }

  /**
   * Changes the user's email address with re-verification.
   *
   * Requires the user to be authenticated. Updates the account's email
   * address to the new value, upserts a new confirmation token, and
   * delivers it through the ConfirmationDeliveryService seam.
   *
   * The response preserves the anti-enumeration property: whether the new
   * email already exists or not, the response is identical. A new confirmation
   * token is issued and delivered (dev: logged; test: silently; production:
   * warning without the token).
   *
   * @param newEmail - The new email address
   * @param userId - The authenticated account ID (passed from the guard)
   * @returns { message: string } 200 with generic anti-enumeration message
   * @throws { UnauthorizedException } if the account is not verified / is banned
   */
  async changeEmail(
    newEmail: string,
    userId: string
  ): Promise<{ message: string }> {
    // Get the current authenticated account.
    const account = await this.prisma.account.findUnique({
      where: { id: userId },
    });

    if (!account) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (!account.isVerified) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (account.isBanned) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    // Update the account's email address and reset verification:
    // the new address must be confirmed before login is allowed again.
    await this.prisma.account.update({
      where: { id: account.id },
      data: { email: newEmail, isVerified: false }
    });

    // Revoke every existing session: tokens issued under the old
    // address must not survive the change (defence in depth — the
    // guard and refresh flow also re-check isVerified).
    await this.sessionService.revokeAllForAccount(account.id);

    // Upsert a new confirmation token for the new email.
    const confirmation = await this.confirmationTokenService.create(
      account.id
    );

    // Deliver the token through the seam.
    // - Development: logs the token so the flow can be exercised locally.
    // - Test environment: delivery is silent (tests capture it through this
    //   service).
    // - Production: a warning is logged without the token; a real mail adapter
    //   must be configured to send the email.
    await this.confirmationDeliveryService.deliver(newEmail, confirmation.token);

    return {
      message:
        'If an unverified account exists for this address, a confirmation token has been issued.'
    };
  }
}