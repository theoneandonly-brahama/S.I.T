import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import { AuthService } from './auth.service.js';
import { AccountService } from '../account/account.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SessionService } from '../session/session.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

describe('AuthService', () => {
  it('returns account id and email on successful authentication', async () => {
    const accountService = {
      findByEmail: vi.fn().mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        passwordHash: 'hash',
        isVerified: true,
      }),
    } as unknown as AccountService;
    const prismaService = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const sessionService = {
      findActiveByAccount: vi.fn(),
      create: vi.fn(),
      revoke: vi.fn(),
    } as unknown as SessionService;
    const passwordService = {
      hash: vi.fn().mockResolvedValue('hashed-string'),
      verify: vi.fn().mockResolvedValue(true),
    } as unknown as PasswordService;
    const tokenService = {} as unknown as TokenService;
    const confirmationTokenService = {
      create: vi.fn(),
    } as unknown as ConfirmationTokenService;
    const confirmationDeliveryService = {
      deliver: vi.fn(),
    } as unknown as ConfirmationDeliveryService;

    const service = new AuthService(
      accountService,
      prismaService,
      sessionService,
      passwordService,
      tokenService,
      confirmationTokenService,
      confirmationDeliveryService
    );

    const result = await service.authenticate('a@b.com', 'pass');
    expect(result).toEqual({ id: '1', email: 'a@b.com' });
  });

  it('throws the same UnauthorizedException when account does not exist', async () => {
    const accountService = {
      findByEmail: vi.fn().mockResolvedValue(null),
    } as unknown as AccountService;
    const prismaService = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const sessionService = {
      findActiveByAccount: vi.fn(),
      create: vi.fn(),
      revoke: vi.fn(),
    } as unknown as SessionService;
    const passwordService = {
      hash: vi.fn(),
      verify: vi.fn(),
    } as unknown as PasswordService;
    const tokenService = {} as unknown as TokenService;
    const confirmationTokenService = {} as unknown as ConfirmationTokenService;
    const confirmationDeliveryService =
      {} as unknown as ConfirmationDeliveryService;

    const service = new AuthService(
      accountService,
      prismaService,
      sessionService,
      passwordService,
      tokenService,
      confirmationTokenService,
      confirmationDeliveryService
    );

    await expect(service.authenticate('nope@b.com', 'pass')).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('throws the same UnauthorizedException when password is wrong', async () => {
    const accountService = {
      findByEmail: vi
        .fn()
        .mockResolvedValue({ id: '1', email: 'a@b.com', passwordHash: 'hash' }),
    } as unknown as AccountService;
    const prismaService = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const sessionService = {
      findActiveByAccount: vi.fn(),
      create: vi.fn(),
      revoke: vi.fn(),
    } as unknown as SessionService;
    const passwordService = {
      hash: vi.fn(),
      verify: vi.fn().mockResolvedValue(false),
    } as unknown as PasswordService;
    const tokenService = {} as unknown as TokenService;
    const confirmationTokenService = {} as unknown as ConfirmationTokenService;
    const confirmationDeliveryService =
      {} as unknown as ConfirmationDeliveryService;

    const service = new AuthService(
      accountService,
      prismaService,
      sessionService,
      passwordService,
      tokenService,
      confirmationTokenService,
      confirmationDeliveryService
    );

    await expect(service.authenticate('a@b.com', 'wrongpass')).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('throws the same UnauthorizedException when the account is not verified', async () => {
    const accountService = {
      findByEmail: vi.fn().mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        passwordHash: 'hash',
        isVerified: false,
      }),
    } as unknown as AccountService;
    const prismaService = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const sessionService = {
      findActiveByAccount: vi.fn(),
      create: vi.fn(),
      revoke: vi.fn(),
    } as unknown as SessionService;
    const passwordService = {
      hash: vi.fn(),
      verify: vi.fn().mockResolvedValue(true),
    } as unknown as PasswordService;
    const tokenService = {} as unknown as TokenService;
    const confirmationTokenService = {} as unknown as ConfirmationTokenService;
    const confirmationDeliveryService =
      {} as unknown as ConfirmationDeliveryService;

    const service = new AuthService(
      accountService,
      prismaService,
      sessionService,
      passwordService,
      tokenService,
      confirmationTokenService,
      confirmationDeliveryService
    );

    await expect(service.authenticate('a@b.com', 'pass')).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('runs argon2 against a dummy hash when account is missing (timing mitigation)', async () => {
    const accountService = {
      findByEmail: vi.fn().mockResolvedValue(null),
    } as unknown as AccountService;
    const prismaService = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const sessionService = {
      findActiveByAccount: vi.fn(),
      create: vi.fn(),
      revoke: vi.fn(),
    } as unknown as SessionService;
    const passwordService = {
      hash: vi.fn().mockResolvedValue('hashed-string'),
      verify: vi.fn(),
    } as unknown as PasswordService;
    const tokenService = {} as unknown as TokenService;
    const confirmationTokenService = {} as unknown as ConfirmationTokenService;
    const confirmationDeliveryService =
      {} as unknown as ConfirmationDeliveryService;

    const service = new AuthService(
      accountService,
      prismaService,
      sessionService,
      passwordService,
      tokenService,
      confirmationTokenService,
      confirmationDeliveryService
    );

    await expect(
      service.authenticate('missing@test.com', 'pass')
    ).rejects.toThrow(UnauthorizedException);
  });

  it('registers an inactive account and creates a confirmation token', async () => {
    const accountService = {
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: '1',
        email: 'new@test.com',
        isVerified: false,
      }),
    } as unknown as AccountService;
    const prismaService = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const sessionService = {
      findActiveByAccount: vi.fn(),
      create: vi.fn(),
      revoke: vi.fn(),
    } as unknown as SessionService;
    const passwordService = {
      hash: vi.fn(),
      verify: vi.fn(),
    } as unknown as PasswordService;
    const tokenService = {} as unknown as TokenService;
    const confirmationTokenService = {
      create: vi
        .fn()
        .mockResolvedValue({ token: 'token-123', expiresAt: new Date() }),
    } as unknown as ConfirmationTokenService;
    const confirmationDeliveryService = {
      deliver: vi.fn(),
    } as unknown as ConfirmationDeliveryService;

    const service = new AuthService(
      accountService,
      prismaService,
      sessionService,
      passwordService,
      tokenService,
      confirmationTokenService,
      confirmationDeliveryService
    );

    const result = await service.register('new@test.com', 'pass');
    expect(result.account.id).toBe('1');
    expect(result.account.email).toBe('new@test.com');
    expect(result.account.isVerified).toBe(false);
    expect(typeof result.confirmation.token).toBe('string');
    expect(result.confirmation.expiresAt).toBeInstanceOf(Date);
  });

  it('does not create a confirmation token when account creation fails', async () => {
    const accountService = {
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockRejectedValue(new Error('Duplicate email')),
    } as unknown as AccountService;
    const prismaService = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const sessionService = {
      findActiveByAccount: vi.fn(),
      create: vi.fn(),
      revoke: vi.fn(),
    } as unknown as SessionService;
    const passwordService = {
      hash: vi.fn(),
      verify: vi.fn(),
    } as unknown as PasswordService;
    const tokenService = {} as unknown as TokenService;
    const confirmationTokenService = {
      create: vi.fn(),
    } as unknown as ConfirmationTokenService;
    const confirmationDeliveryService =
      {} as unknown as ConfirmationDeliveryService;

    const service = new AuthService(
      accountService,
      prismaService,
      sessionService,
      passwordService,
      tokenService,
      confirmationTokenService,
      confirmationDeliveryService
    );

    await expect(service.register('existing@test.com', 'pass')).rejects.toThrow(
      Error
    );
  });

  it('changePassword updates the hash when the current password matches', async () => {
    const accountService = {} as unknown as AccountService;
    const prismaService = {
      account: {
        findUnique: vi.fn().mockResolvedValue({
          id: '1',
          email: 'a@b.com',
          passwordHash: 'old-hash',
          isVerified: true,
          isBanned: false,
        }),
        update: vi.fn().mockResolvedValue({ id: '1' }),
      },
    } as unknown as PrismaService;
    const sessionService = {} as unknown as SessionService;
    const passwordService = {
      verify: vi.fn().mockResolvedValue(true),
      validatePassword: vi.fn(),
      hash: vi.fn().mockResolvedValue('new-hash'),
    } as unknown as PasswordService;
    const tokenService = {} as unknown as TokenService;
    const confirmationTokenService = {} as unknown as ConfirmationTokenService;
    const confirmationDeliveryService =
      {} as unknown as ConfirmationDeliveryService;

    const service = new AuthService(
      accountService,
      prismaService,
      sessionService,
      passwordService,
      tokenService,
      confirmationTokenService,
      confirmationDeliveryService
    );

    const result = await service.changePassword('OldPass1!', 'NewPass2!', '1');
    expect(result).toEqual({ success: true });
    expect(passwordService.verify).toHaveBeenCalledWith(
      'OldPass1!',
      'old-hash'
    );
    expect(passwordService.validatePassword).toHaveBeenCalledWith('NewPass2!');
    expect(prismaService.account.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { passwordHash: 'new-hash' },
    });
  });

  it('changePassword rejects a wrong current password with the uniform 401', async () => {
    const accountService = {} as unknown as AccountService;
    const update = vi.fn();
    const prismaService = {
      account: {
        findUnique: vi.fn().mockResolvedValue({
          id: '1',
          email: 'a@b.com',
          passwordHash: 'old-hash',
          isVerified: true,
          isBanned: false,
        }),
        update,
      },
    } as unknown as PrismaService;
    const sessionService = {} as unknown as SessionService;
    const passwordService = {
      verify: vi.fn().mockResolvedValue(false),
      validatePassword: vi.fn(),
      hash: vi.fn(),
    } as unknown as PasswordService;
    const tokenService = {} as unknown as TokenService;
    const confirmationTokenService = {} as unknown as ConfirmationTokenService;
    const confirmationDeliveryService =
      {} as unknown as ConfirmationDeliveryService;

    const service = new AuthService(
      accountService,
      prismaService,
      sessionService,
      passwordService,
      tokenService,
      confirmationTokenService,
      confirmationDeliveryService
    );

    await expect(
      service.changePassword('WrongPass1!', 'NewPass2!', '1')
    ).rejects.toThrow(UnauthorizedException);
    expect(update).not.toHaveBeenCalled();
  });

  it('changePassword rejects missing, unverified, and banned accounts with the uniform 401', async () => {
    for (const account of [
      null,
      {
        id: '1',
        email: 'a@b.com',
        passwordHash: 'hash',
        isVerified: false,
        isBanned: false,
      },
      {
        id: '1',
        email: 'a@b.com',
        passwordHash: 'hash',
        isVerified: true,
        isBanned: true,
      },
    ]) {
      const accountService = {} as unknown as AccountService;
      const update = vi.fn();
      const prismaService = {
        account: { findUnique: vi.fn().mockResolvedValue(account), update },
      } as unknown as PrismaService;
      const sessionService = {} as unknown as SessionService;
      const passwordService = {
        verify: vi.fn(),
        validatePassword: vi.fn(),
        hash: vi.fn(),
      } as unknown as PasswordService;
      const tokenService = {} as unknown as TokenService;
      const confirmationTokenService =
        {} as unknown as ConfirmationTokenService;
      const confirmationDeliveryService =
        {} as unknown as ConfirmationDeliveryService;

      const service = new AuthService(
        accountService,
        prismaService,
        sessionService,
        passwordService,
        tokenService,
        confirmationTokenService,
        confirmationDeliveryService
      );

      await expect(
        service.changePassword('OldPass1!', 'NewPass2!', '1')
      ).rejects.toThrow(UnauthorizedException);
      expect(update).not.toHaveBeenCalled();
    }
  });

  it('changeEmail updates the email, issues a token, and delivers it', async () => {
    const accountService = {} as unknown as AccountService;
    const update = vi.fn().mockResolvedValue({ id: '1' });
    const prismaService = {
      account: {
        findUnique: vi.fn().mockResolvedValue({
          id: '1',
          email: 'old@b.com',
          passwordHash: 'hash',
          isVerified: true,
          isBanned: false,
        }),
        update,
      },
    } as unknown as PrismaService;
    const revokeAllForAccount = vi.fn().mockResolvedValue(undefined);
    const sessionService = { revokeAllForAccount } as unknown as SessionService;
    const passwordService = {} as unknown as PasswordService;
    const tokenService = {} as unknown as TokenService;
    const confirmationTokenService = {
      create: vi
        .fn()
        .mockResolvedValue({ token: 'token-123', expiresAt: new Date() }),
    } as unknown as ConfirmationTokenService;
    const confirmationDeliveryService = {
      deliver: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConfirmationDeliveryService;

    const service = new AuthService(
      accountService,
      prismaService,
      sessionService,
      passwordService,
      tokenService,
      confirmationTokenService,
      confirmationDeliveryService
    );

    const result = await service.changeEmail('new@b.com', '1');
    expect(result.message).toMatch(/If an unverified account exists/);
    expect(update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { email: 'new@b.com', isVerified: false },
    });
    expect(confirmationTokenService.create).toHaveBeenCalledWith('1');
    expect(confirmationDeliveryService.deliver).toHaveBeenCalledWith(
      'new@b.com',
      'token-123'
    );
    expect(revokeAllForAccount).toHaveBeenCalledWith('1');
  });

  it('changeEmail rejects missing, unverified, and banned accounts with the uniform 401', async () => {
    for (const account of [
      null,
      {
        id: '1',
        email: 'a@b.com',
        passwordHash: 'hash',
        isVerified: false,
        isBanned: false,
      },
      {
        id: '1',
        email: 'a@b.com',
        passwordHash: 'hash',
        isVerified: true,
        isBanned: true,
      },
    ]) {
      const accountService = {} as unknown as AccountService;
      const update = vi.fn();
      const prismaService = {
        account: { findUnique: vi.fn().mockResolvedValue(account), update },
      } as unknown as PrismaService;
      const sessionService = {} as unknown as SessionService;
      const passwordService = {} as unknown as PasswordService;
      const tokenService = {} as unknown as TokenService;
      const confirmationTokenService = {
        create: vi.fn(),
      } as unknown as ConfirmationTokenService;
      const confirmationDeliveryService = {
        deliver: vi.fn(),
      } as unknown as ConfirmationDeliveryService;

      const service = new AuthService(
        accountService,
        prismaService,
        sessionService,
        passwordService,
        tokenService,
        confirmationTokenService,
        confirmationDeliveryService
      );

      await expect(service.changeEmail('new@b.com', '1')).rejects.toThrow(
        UnauthorizedException
      );
      expect(update).not.toHaveBeenCalled();
      expect(confirmationTokenService.create).not.toHaveBeenCalled();
    }
  });

  it('refresh rejects a garbage token with no subject', async () => {
    const accountService = {} as unknown as AccountService;
    const prismaService = {
      account: { findUnique: vi.fn() },
    } as unknown as PrismaService;
    const sessionService = {
      findActiveByAccount: vi.fn(),
    } as unknown as SessionService;
    const passwordService = {} as unknown as PasswordService;
    const tokenService = {} as unknown as TokenService;
    const confirmationTokenService = {} as unknown as ConfirmationTokenService;
    const confirmationDeliveryService =
      {} as unknown as ConfirmationDeliveryService;

    const service = new AuthService(
      accountService,
      prismaService,
      sessionService,
      passwordService,
      tokenService,
      confirmationTokenService,
      confirmationDeliveryService
    );

    await expect(service.refresh('garbage-token')).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('refresh rejects a banned, unverified, or missing account with the uniform 401', async () => {
    for (const account of [
      null,
      { id: '1', email: 'a@b.com', isVerified: false, isBanned: false },
      { id: '1', email: 'a@b.com', isVerified: true, isBanned: true },
    ]) {
      const accountService = {} as unknown as AccountService;
      const prismaService = {
        account: { findUnique: vi.fn().mockResolvedValue(account) },
      } as unknown as PrismaService;
      const sessionService = {
        findActiveByAccount: vi.fn(),
      } as unknown as SessionService;
      const passwordService = {} as unknown as PasswordService;
      const tokenService = new TokenService();
      const confirmationTokenService =
        {} as unknown as ConfirmationTokenService;
      const confirmationDeliveryService =
        {} as unknown as ConfirmationDeliveryService;

      const service = new AuthService(
        accountService,
        prismaService,
        sessionService,
        passwordService,
        tokenService,
        confirmationTokenService,
        confirmationDeliveryService
      );

      const token = tokenService.signRefreshToken({ sub: '1' });
      await expect(service.refresh(token)).rejects.toThrow(
        UnauthorizedException
      );
    }
  });

  it('refresh rotates a matching session and issues a new pair', async () => {
    const tokenService = new TokenService();
    const refreshToken = tokenService.signRefreshToken({ sub: '1' });
    const hash = await argon2.hash(refreshToken);

    const accountService = {} as unknown as AccountService;
    const prismaService = {
      account: {
        findUnique: vi.fn().mockResolvedValue({
          id: '1',
          email: 'a@b.com',
          isVerified: true,
          isBanned: false,
        }),
      },
    } as unknown as PrismaService;
    const revoke = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn().mockResolvedValue({ id: '2' });
    const sessionService = {
      findActiveByAccount: vi
        .fn()
        .mockResolvedValue([{ id: 's1', refreshTokenHash: hash }]),
      revoke,
      create,
    } as unknown as SessionService;
    const passwordService = {} as unknown as PasswordService;
    const confirmationTokenService = {} as unknown as ConfirmationTokenService;
    const confirmationDeliveryService =
      {} as unknown as ConfirmationDeliveryService;

    const service = new AuthService(
      accountService,
      prismaService,
      sessionService,
      passwordService,
      tokenService,
      confirmationTokenService,
      confirmationDeliveryService
    );

    const result = await service.refresh(refreshToken);
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
    expect(result.refreshToken).not.toBe(refreshToken);
    expect(revoke).toHaveBeenCalledWith('s1');
    expect(create).toHaveBeenCalledWith(
      '1',
      expect.any(String),
      expect.any(Date)
    );
  });

  it('logout rejects a garbage token and revokes a matching session', async () => {
    const tokenService = new TokenService();

    // Garbage token → 401
    {
      const accountService = {} as unknown as AccountService;
      const prismaService = {} as unknown as PrismaService;
      const sessionService = {
        findActiveByAccount: vi.fn(),
      } as unknown as SessionService;
      const passwordService = {} as unknown as PasswordService;
      const confirmationTokenService =
        {} as unknown as ConfirmationTokenService;
      const confirmationDeliveryService =
        {} as unknown as ConfirmationDeliveryService;
      const service = new AuthService(
        accountService,
        prismaService,
        sessionService,
        passwordService,
        tokenService,
        confirmationTokenService,
        confirmationDeliveryService
      );
      await expect(service.logout('garbage-token')).rejects.toThrow(
        UnauthorizedException
      );
    }

    // Matching session → revoked, resolves void
    const refreshToken = tokenService.signRefreshToken({ sub: '1' });
    const hash = await argon2.hash(refreshToken);
    const accountService = {} as unknown as AccountService;
    const prismaService = {} as unknown as PrismaService;
    const revoke = vi.fn().mockResolvedValue(undefined);
    const sessionService = {
      findActiveByAccount: vi
        .fn()
        .mockResolvedValue([{ id: 's1', refreshTokenHash: hash }]),
      revoke,
    } as unknown as SessionService;
    const passwordService = {} as unknown as PasswordService;
    const confirmationTokenService = {} as unknown as ConfirmationTokenService;
    const confirmationDeliveryService =
      {} as unknown as ConfirmationDeliveryService;
    const service = new AuthService(
      accountService,
      prismaService,
      sessionService,
      passwordService,
      tokenService,
      confirmationTokenService,
      confirmationDeliveryService
    );

    await expect(service.logout(refreshToken)).resolves.toBeUndefined();
    expect(revoke).toHaveBeenCalledWith('s1');
  });
});
