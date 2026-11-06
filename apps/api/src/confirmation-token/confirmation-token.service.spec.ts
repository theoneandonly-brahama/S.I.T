import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import argon2 from 'argon2';
import { ConfirmationTokenService } from './confirmation-token.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const mockPrisma = {
  confirmationToken: {
    updateMany: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
} as unknown as PrismaService;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ConfirmationTokenService', () => {
  const service = new ConfirmationTokenService(mockPrisma);

  it('revokes prior unused token before creating a new one', async () => {
    mockPrisma.confirmationToken.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.confirmationToken.create.mockResolvedValue({
      id: '1',
      accountId: 'acc',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 86400000),
      consumedAt: null,
    });

    vi.spyOn(argon2, 'hash').mockResolvedValue('hashed-token');

    const { token } = await service.create('acc');

    expect(mockPrisma.confirmationToken.updateMany).toHaveBeenCalledWith({
      where: { accountId: 'acc', consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
    expect(mockPrisma.confirmationToken.create).toHaveBeenCalledWith({
      data: {
        accountId: 'acc',
        tokenHash: 'hashed-token',
        expiresAt: expect.any(Date),
        consumedAt: null,
      },
    });
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('throws UnauthorizedException when token is expired', async () => {
    // All tokens are expired: findMany returns empty array
    mockPrisma.confirmationToken.findMany.mockResolvedValue([]);

    await expect(service.verify('token')).rejects.toThrow(UnauthorizedException);
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
});
