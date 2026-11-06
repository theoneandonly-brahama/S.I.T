import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AccountService } from './account.service.js';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

const mockPrisma = {
  account: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
} as unknown as PrismaService;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AccountService', () => {
  const service = new AccountService(mockPrisma);

  it('throws ConflictException when email already exists', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({
      id: 'existing',
      email: 'a@b.com',
    });
    await expect(service.create('a@b.com', 'hash')).rejects.toThrow(
      ConflictException
    );
  });

  it('creates account and strips passwordHash from response', async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.account.create.mockResolvedValue({
      id: '1',
      email: 'a@b.com',
      passwordHash: 'secret',
      role: Role.STUDENT,
      isVerified: false,
      isBanned: false,
      bannedAt: null,
      bannedUntil: null,
      banReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await service.create('a@b.com', 'hash');
    expect(result.passwordHash).toBeUndefined();
    expect(result.email).toBe('a@b.com');
    expect(result.role).toBe(Role.STUDENT);
  });

  it('throws NotFoundException when account is missing', async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);
    await expect(service.findById('nope')).rejects.toThrow(NotFoundException);
  });

  it('marks account as verified', async () => {
    mockPrisma.account.update.mockResolvedValue({ id: '1', isVerified: true });
    const result = await service.markVerified('1');
    expect(result.isVerified).toBe(true);
  });

  it('sets ban status with audit columns', async () => {
    const now = new Date();
    mockPrisma.account.update.mockResolvedValue({
      id: '1',
      isBanned: true,
      bannedAt: now,
      banReason: 'spam',
    });
    const result = await service.setBanStatus('1', true, now, null, 'spam');
    expect(result.isBanned).toBe(true);
    expect(result.banReason).toBe('spam');
  });
});
