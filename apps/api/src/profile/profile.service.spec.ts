import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProfileService } from './profile.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const mockPrisma = {
  profile: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
} as unknown as PrismaService;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ProfileService', () => {
  const service = new ProfileService(mockPrisma);

  it('throws ConflictException when profile already exists', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ id: '1', accountId: 'acc' });
    await expect(
      service.create('acc', { firstName: 'Ada', lastName: 'Lovelace' }),
    ).rejects.toThrow(ConflictException);
  });

  it('creates profile and maps null optional fields to undefined', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    mockPrisma.profile.create.mockResolvedValue({
      id: '1',
      accountId: 'acc',
      firstName: 'Ada',
      lastName: 'Lovelace',
      diploma: null,
      university: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create('acc', {
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    expect(result.diploma).toBeUndefined();
    expect(result.university).toBeUndefined();
    expect(result.firstName).toBe('Ada');
  });

  it('throws NotFoundException when profile missing', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    await expect(service.findByAccountId('acc')).rejects.toThrow(NotFoundException);
  });

  it('updates only provided fields (patch semantics)', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      id: '1',
      accountId: 'acc',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    mockPrisma.profile.update.mockResolvedValue({
      id: '1',
      accountId: 'acc',
      firstName: 'Ada',
      lastName: 'Lovelace Updated',
    });

    const result = await service.update('acc', { lastName: 'Lovelace Updated' });

    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { accountId: 'acc' },
      data: { lastName: 'Lovelace Updated' },
    });
    expect(result.lastName).toBe('Lovelace Updated');
  });
});
