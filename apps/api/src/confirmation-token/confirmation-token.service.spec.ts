import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import argon2 from 'argon2';
import { ConfirmationTokenService } from './confirmation-token.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const mockPrisma = {
  account: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  confirmationToken: {
    upsert: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
} as unknown as PrismaService;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ConfirmationTokenService', () => {
  const service = new ConfirmationTokenService(mockPrisma);

  it('overwrites the account token row so a reissue invalidates the old token', async () => {
    mockPrisma.confirmationToken.upsert.mockResolvedValue({
      id: '1',
      accountId: 'acc',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 86400000),
      consumedAt: null,
    });

    vi.spyOn(argon2, 'hash').mockResolvedValue('hashed-token');

    const { token, expiresAt } = await service.create('acc');

    expect(mockPrisma.confirmationToken.upsert).toHaveBeenCalledWith({
      where: { accountId: 'acc' },
      update: {
        tokenHash: 'hashed-token',
        expiresAt: expect.any(Date),
        consumedAt: null,
      },
      create: {
        accountId: 'acc',
        tokenHash: 'hashed-token',
        expiresAt: expect.any(Date),
        consumedAt: null,
      },
    });
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(expiresAt).toBeInstanceOf(Date);
  });

  it('issues a token for an unverified account', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({
      id: 'acc',
      email: 'a@b.com',
      isVerified: false,
    });
    mockPrisma.confirmationToken.upsert.mockResolvedValue({
      id: '1',
      accountId: 'acc',
      tokenHash: 'hashed-token',
      expiresAt: new Date(Date.now() + 86400000),
      consumedAt: null,
    });

    vi.spyOn(argon2, 'hash').mockResolvedValue('hashed-token');

    const result = await service.resend('a@b.com');

    expect(result?.token).toBeDefined();
    expect(mockPrisma.confirmationToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: 'acc' } })
    );
  });

  it('does not issue a token for a verified account but still burns a hash', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({
      id: 'acc',
      email: 'a@b.com',
      isVerified: true,
    });
    const hash = vi.spyOn(argon2, 'hash').mockResolvedValue('dummy-hash');

    const result = await service.resend('a@b.com');

    expect(result).toBeNull();
    expect(mockPrisma.confirmationToken.upsert).not.toHaveBeenCalled();
    expect(hash).toHaveBeenCalled();
  });

  it('does not issue a token for an unknown account but still burns a hash', async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);
    const hash = vi.spyOn(argon2, 'hash').mockResolvedValue('dummy-hash');

    const result = await service.resend('missing@b.com');

    expect(result).toBeNull();
    expect(mockPrisma.confirmationToken.upsert).not.toHaveBeenCalled();
    expect(hash).toHaveBeenCalled();
  });

  it('throws UnauthorizedException when token is expired', async () => {
    // All tokens are expired: findMany returns empty array
    mockPrisma.confirmationToken.findMany.mockResolvedValue([]);

    await expect(service.verify('token')).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('throws UnauthorizedException when token is already consumed', async () => {
    mockPrisma.confirmationToken.findUnique.mockResolvedValue({
      id: '1',
      consumedAt: new Date(),
    });

    await expect(service.consume('1')).rejects.toThrow(UnauthorizedException);
  });

  it('throws NotFoundException when token does not exist', async () => {
    mockPrisma.confirmationToken.findUnique.mockResolvedValue(null);

    await expect(service.consume('missing')).rejects.toThrow(NotFoundException);
  });

  it('verifyAndMarkVerified consumes the token and marks the account verified in one transaction', async () => {
    const hash = await argon2.hash('good-token');
    mockPrisma.confirmationToken.findMany.mockResolvedValue([
      {
        id: '1',
        accountId: 'acc',
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 86400000),
        consumedAt: null,
      },
    ]);
    const tx = {
      confirmationToken: { update: vi.fn().mockResolvedValue({}) },
      account: { update: vi.fn().mockResolvedValue({}) },
    };
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)
    );

    const record = await service.verifyAndMarkVerified('good-token');

    expect(record.id).toBe('1');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.confirmationToken.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { consumedAt: expect.any(Date) },
    });
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: 'acc' },
      data: { isVerified: true },
    });
  });

  it('verifyAndMarkVerified writes nothing when the token is invalid', async () => {
    mockPrisma.confirmationToken.findMany.mockResolvedValue([]);

    await expect(service.verifyAndMarkVerified('bad-token')).rejects.toThrow(
      UnauthorizedException
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
