import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

const { sign, verify, TokenExpiredError } = jwt;

/**
 * TokenService issues and verifies short-lived JWT access tokens and
 * refresh tokens.
 *
 * Access tokens are stateless JWTs signed with JWT_SECRET and expire
 * after JWT_ACCESS_TTL (default 900s = 15 minutes).
 *
 * Refresh tokens are also JWTs (signed with JWT_SECRET, expire after
 * JWT_REFRESH_TTL). The refresh token string is stored hashed in the
 * Session table (Session.refreshTokenHash) so that a database leak does
 * not expose usable refresh tokens. To validate a presented refresh
 * token, it is decoded (signature not verified at decode time) to obtain
 * the account id, then each active session for that account is checked
 * with argon2.verify against the stored hash.
 */
@Injectable()
export class TokenService {
  private readonly secret: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor() {
    this.secret =
      process.env.JWT_SECRET || 'change-me-in-production-32-chars-min';
    this.accessTtlSeconds = Number(process.env.JWT_ACCESS_TTL) || 900;
    this.refreshTtlSeconds = Number(process.env.JWT_REFRESH_TTL) || 604800;
  }

  /**
   * Signs a short-lived JWT access token.
   * Payload carries the account id (sub) and email.
   */
  signAccessToken(payload: { sub: string; email: string }): string {
    return sign(payload, this.secret, {
      expiresIn: this.accessTtlSeconds,
      issuer: 'sit-api',
      audience: 'sit-client',
    });
  }

  /**
   * Signs a refresh token JWT.
   * The payload carries the account id (sub) plus a unique per-issuance `jti`.
   * The `jti` is essential for correctness: jsonwebtoken auto-stamps `iat`
   * (seconds), so two refresh tokens signed for the same account inside the
   * same second would otherwise be the *identical plaintext string*. Session
   * validation matches tokens by argon2 hash comparison, so sibling sessions
   * created from that same string would keep authenticating a token after
   * its session was revoked — breaking rotation-revocation and logout.
   * The cryptographic nonce guarantees every issued token string is unique.
   */
  signRefreshToken(payload: { sub: string }): string {
    return sign({ ...payload, jti: randomUUID() }, this.secret, {
      expiresIn: this.refreshTtlSeconds,
      issuer: 'sit-api',
      audience: 'sit-client',
    });
  }

  /**
   * Verifies a JWT access token and returns its payload.
   * Throws UnauthorizedException on expired or malformed tokens.
   */
  verifyAccessToken(token: string): {
    sub: string;
    email: string;
    iat: number;
    exp: number;
  } {
    try {
      const payload = verify(token, this.secret, {
        issuer: 'sit-api',
        audience: 'sit-client',
      }) as { sub: string; email: string; iat: number; exp: number };
      return payload;
    } catch (err) {
      // Expired tokens get a distinct message; every other verification
      // failure (malformed, bad signature, wrong issuer/audience) gets
      // the uniform invalid message. The JsonWebTokenError distinction
      // was removed: both branches threw the same message, making the
      // mutant-killing impossible and the branch dead weight.
      if (err instanceof TokenExpiredError) {
        throw new UnauthorizedException('Access token expired.');
      }
      throw new UnauthorizedException('Invalid access token.');
    }
  }
}
