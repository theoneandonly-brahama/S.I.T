import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const mockPrisma = {
  upload: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
} as unknown as PrismaService;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('UploadService', () => {
  const service = new UploadService(mockPrisma);

  it('rejects file larger than max size', async () => {
    await expect(
      service.uploadFile('acc', {
        originalname: 'big.pdf',
        mimetype: 'application/pdf',
        size: 10 * 1024 * 1024,
        buffer: Buffer.alloc(10),
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects disallowed MIME type', async () => {
    await expect(
      service.uploadFile('acc', {
        originalname: 'script.sh',
        mimetype: 'application/x-shellscript',
        size: 100,
        buffer: Buffer.alloc(10),
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('uses random storage key, never the original filename', async () => {
    mockPrisma.upload.create.mockResolvedValue({
      id: '1',
      accountId: 'acc',
      originalName: 'my photo.jpg',
      storageKey: 'random-key.jpg',
      mimeType: 'image/jpeg',
      size: 100,
      createdAt: new Date(),
    });

    const result = await service.uploadFile('acc', {
      originalname: '../../etc/passwd',
      mimetype: 'image/jpeg',
      size: 100,
      buffer: Buffer.alloc(10),
    });

    // Storage key must not leak the original filename or path
    expect(result.storageKey).not.toContain('passwd');
    expect(result.storageKey).not.toBe('../../etc/passwd');
    expect(result.storageKey).not.toBe('my photo.jpg');
    // Storage key has a MIME-derived extension
    expect(result.storageKey).toMatch(/\.jpg$/);
    expect(mockPrisma.upload.create).toHaveBeenCalledWith({
      data: {
        accountId: 'acc',
        originalName: '../../etc/passwd',
        storageKey: expect.stringMatching(/\.jpg$/),
        mimeType: 'image/jpeg',
        size: 100,
      },
    });
  });
});
