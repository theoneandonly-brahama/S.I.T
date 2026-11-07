import { describe, it, expect } from 'vitest';
import { decode } from 'jsonwebtoken';
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
});
