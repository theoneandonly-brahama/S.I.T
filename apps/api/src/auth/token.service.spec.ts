import { describe, it, expect } from 'vitest';
import { decode, sign } from 'jsonwebtoken';
import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service.js';

describe('TokenService', () => {
  const service = new TokenService();

  describe('signRefreshToken', () => {
    // Dual sessions issued within one `iat` second used to produce the
    // identical plaintext token (payload-only signing), letting a revoked
    // session's token still verify against sibling sessions. The unique
    // per-issuance `jti` is what makes rotation-revocation valid.
    it('never returns the same string for two issuances of the same account, even in the same second', () => {
      const sub = 'acc-1';

      const first = service.signRefreshToken({ sub });
      const second = service.signRefreshToken({ sub });

      expect(first).not.toBe(second);
    });

    it('keeps the account id (sub) and issues a unique jti per token', () => {
      const sub = 'acc-1';

      const first = decode(service.signRefreshToken({ sub })) as {
        sub?: string;
        jti?: string;
      };
      const second = decode(service.signRefreshToken({ sub })) as {
        sub?: string;
        jti?: string;
      };

      expect(first.sub).toBe(sub);
      expect(second.sub).toBe(sub);
      expect(typeof first.jti).toBe('string');
      expect(typeof second.jti).toBe('string');
      expect(first.jti).not.toBe(second.jti);
    });
  });

  describe('verifyAccessToken', () => {
    it('returns the payload for a valid token', () => {
      const token = sign(
        { sub: 'acc-1', email: 'a@b.com' },
        'change-me-in-production-32-chars-min',
        { expiresIn: 900, issuer: 'sit-api', audience: 'sit-client' }
      );

      const payload = service.verifyAccessToken(token);
      expect(payload.sub).toBe('acc-1');
      expect(payload.email).toBe('a@b.com');
    });

    it('throws the expired message for an expired token', () => {
      const token = sign(
        { sub: 'acc-1', email: 'a@b.com' },
        'change-me-in-production-32-chars-min',
        { expiresIn: -10, issuer: 'sit-api', audience: 'sit-client' }
      );

      expect(() => service.verifyAccessToken(token)).toThrow(
        new UnauthorizedException('Access token expired.')
      );
    });

    it('throws the invalid message for a malformed token', () => {
      expect(() => service.verifyAccessToken('not-a-jwt')).toThrow(
        new UnauthorizedException('Invalid access token.')
      );
    });

    it('throws the invalid message for a token signed with the wrong secret', () => {
      const token = sign(
        { sub: 'acc-1', email: 'a@b.com' },
        'some-other-secret-that-is-long-enough',
        { expiresIn: 900, issuer: 'sit-api', audience: 'sit-client' }
      );

      expect(() => service.verifyAccessToken(token)).toThrow(
        new UnauthorizedException('Invalid access token.')
      );
    });
  });
});
