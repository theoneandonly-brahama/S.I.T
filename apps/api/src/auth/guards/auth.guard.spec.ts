import { describe, it, expect, vi } from 'vitest';
import {
  ExecutionContext,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from './auth.guard.js';
import { AccountService } from '../../account/account.service.js';
import { TokenService } from '../token.service.js';

function contextWith(headers: Record<string, string>) {
  const request: Record<string, unknown> = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('JwtAuthGuard', () => {
  it('rejects requests without an Authorization header', async () => {
    const accountService = { findById: vi.fn() } as unknown as AccountService;
    const tokenService = {
      verifyAccessToken: vi.fn(),
    } as unknown as TokenService;
    const guard = new JwtAuthGuard(accountService, tokenService);
    const { context } = contextWith({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Missing or invalid authorization header.')
    );
  });

  it('rejects a non-Bearer Authorization header', async () => {
    const accountService = { findById: vi.fn() } as unknown as AccountService;
    const tokenService = {
      verifyAccessToken: vi.fn(),
    } as unknown as TokenService;
    const guard = new JwtAuthGuard(accountService, tokenService);
    const { context } = contextWith({ authorization: 'Basic abc' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('rejects an invalid or expired access token with a generic 401', async () => {
    const accountService = { findById: vi.fn() } as unknown as AccountService;
    const tokenService = {
      verifyAccessToken: vi.fn().mockImplementation(() => {
        throw new Error('jwt expired');
      }),
    } as unknown as TokenService;
    const guard = new JwtAuthGuard(accountService, tokenService);
    const { context } = contextWith({ authorization: 'Bearer bad-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or expired access token.')
    );
  });

  it('rejects a token whose account no longer exists', async () => {
    const accountService = {
      findById: vi
        .fn()
        .mockRejectedValue(new NotFoundException('Account not found.')),
    } as unknown as AccountService;
    const tokenService = {
      verifyAccessToken: vi
        .fn()
        .mockReturnValue({ sub: 'gone', email: 'g@b.com' }),
    } as unknown as TokenService;
    const guard = new JwtAuthGuard(accountService, tokenService);
    const { context } = contextWith({ authorization: 'Bearer valid-looking' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('rejects unverified and banned accounts with the uniform message', async () => {
    for (const account of [
      { id: '1', email: 'a@b.com', isVerified: false, isBanned: false },
      { id: '1', email: 'a@b.com', isVerified: true, isBanned: true },
    ]) {
      const accountService = {
        findById: vi.fn().mockResolvedValue(account),
      } as unknown as AccountService;
      const tokenService = {
        verifyAccessToken: vi
          .fn()
          .mockReturnValue({ sub: '1', email: 'a@b.com' }),
      } as unknown as TokenService;
      const guard = new JwtAuthGuard(accountService, tokenService);
      const { context } = contextWith({
        authorization: 'Bearer valid-looking',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials.')
      );
    }
  });

  it('allows a verified, non-banned account and attaches req.user', async () => {
    const accountService = {
      findById: vi.fn().mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        isVerified: true,
        isBanned: false,
      }),
    } as unknown as AccountService;
    const tokenService = {
      verifyAccessToken: vi
        .fn()
        .mockReturnValue({ sub: '1', email: 'a@b.com' }),
    } as unknown as TokenService;
    const guard = new JwtAuthGuard(accountService, tokenService);
    const { context, request } = contextWith({
      authorization: 'Bearer valid-looking',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ sub: '1', email: 'a@b.com' });
  });
});
