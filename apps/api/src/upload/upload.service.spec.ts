import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PROFILE_CV_MAX_SIZE,
  PROFILE_PHOTO_MAX_SIZE,
} from './upload.constants.js';

const mockPrisma = {
  upload: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
} as unknown as PrismaService;

const now = new Date();

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const PDF_BYTES = Buffer.from('%PDF-1.4');

function storedUpload(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    accountId: 'acc',
    originalName: 'file',
    storageKey: 'random-key',
    mimeType: 'image/png',
    size: 100,
    purpose: 'GENERAL',
    createdAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('UploadService', () => {
  const service = new UploadService(mockPrisma);

  it('rejects a general file larger than the configured maximum', async () => {
    await expect(
      service.uploadFile('acc', {
        originalname: 'big.pdf',
        mimetype: 'application/pdf',
        size: 10 * 1024 * 1024,
        buffer: Buffer.alloc(10),
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a disallowed general MIME type', async () => {
    await expect(
      service.uploadFile('acc', {
        originalname: 'script.sh',
        mimetype: 'application/x-shellscript',
        size: 100,
        buffer: Buffer.alloc(10),
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('uses a random storage key and stores the GENERAL purpose', async () => {
    mockPrisma.upload.create.mockResolvedValue(
      storedUpload({
        originalName: '../../etc/passwd',
        storageKey: 'random-key.jpg',
        mimeType: 'image/jpeg',
        purpose: 'GENERAL',
      })
    );

    const result = await service.uploadFile('acc', {
      originalname: '../../etc/passwd',
      mimetype: 'image/jpeg',
      size: 100,
      buffer: JPEG_BYTES,
    });

    // Storage key must not leak the original filename or path
    expect(result.storageKey).not.toContain('passwd');
    expect(result.storageKey).not.toBe('../../etc/passwd');
    expect(result.storageKey).not.toBe('my photo.jpg');
    // Storage key has a MIME-derived extension
    expect(result.storageKey).toMatch(/\.jpg$/);
    expect(result.purpose).toBe('GENERAL');
    expect(mockPrisma.upload.create).toHaveBeenCalledWith({
      data: {
        accountId: 'acc',
        originalName: '../../etc/passwd',
        storageKey: expect.stringMatching(/\.jpg$/),
        mimeType: 'image/jpeg',
        size: 100,
        purpose: 'GENERAL',
      },
    });
  });

  it('rejects a profile photo larger than 2 MB', async () => {
    await expect(
      service.uploadFile(
        'acc',
        {
          originalname: 'big.png',
          mimetype: 'image/png',
          size: PROFILE_PHOTO_MAX_SIZE + 1,
          buffer: Buffer.alloc(10),
        },
        'PROFILE_PHOTO'
      )
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a profile photo that is not JPEG or PNG', async () => {
    await expect(
      service.uploadFile(
        'acc',
        {
          originalname: 'photo.gif',
          mimetype: 'image/gif',
          size: 100,
          buffer: Buffer.alloc(10),
        },
        'PROFILE_PHOTO'
      )
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a profile photo at the 2 MB limit and stores the slot', async () => {
    mockPrisma.upload.create.mockResolvedValue(
      storedUpload({
        originalName: 'me.jpg',
        storageKey: 'random-key.jpg',
        mimeType: 'image/jpeg',
        size: PROFILE_PHOTO_MAX_SIZE,
        purpose: 'PROFILE_PHOTO',
      })
    );

    const result = await service.uploadFile(
      'acc',
      {
        originalname: 'me.jpg',
        mimetype: 'image/jpeg',
        size: PROFILE_PHOTO_MAX_SIZE,
        buffer: JPEG_BYTES,
      },
      'PROFILE_PHOTO'
    );

    expect(result.purpose).toBe('PROFILE_PHOTO');
    expect(mockPrisma.upload.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        purpose: 'PROFILE_PHOTO',
        size: PROFILE_PHOTO_MAX_SIZE,
      }),
    });
  });

  it('rejects a CV larger than 5 MB', async () => {
    await expect(
      service.uploadFile(
        'acc',
        {
          originalname: 'big.pdf',
          mimetype: 'application/pdf',
          size: PROFILE_CV_MAX_SIZE + 1,
          buffer: Buffer.alloc(10),
        },
        'PROFILE_CV'
      )
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a CV that is not a PDF', async () => {
    await expect(
      service.uploadFile(
        'acc',
        {
          originalname: 'cv.png',
          mimetype: 'image/png',
          size: 100,
          buffer: Buffer.alloc(10),
        },
        'PROFILE_CV'
      )
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a CV at the 5 MB limit and stores the slot', async () => {
    mockPrisma.upload.create.mockResolvedValue(
      storedUpload({
        originalName: 'cv.pdf',
        storageKey: 'random-key.pdf',
        mimeType: 'application/pdf',
        size: PROFILE_CV_MAX_SIZE,
        purpose: 'PROFILE_CV',
      })
    );

    const result = await service.uploadFile(
      'acc',
      {
        originalname: 'cv.pdf',
        mimetype: 'application/pdf',
        size: PROFILE_CV_MAX_SIZE,
        buffer: PDF_BYTES,
      },
      'PROFILE_CV'
    );

    expect(result.purpose).toBe('PROFILE_CV');
    expect(mockPrisma.upload.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        purpose: 'PROFILE_CV',
        size: PROFILE_CV_MAX_SIZE,
      }),
    });
  });

  it('returns the purpose in signed-access metadata', async () => {
    mockPrisma.upload.findUnique.mockResolvedValue(
      storedUpload({
        storageKey: 'cv-key.pdf',
        mimeType: 'application/pdf',
        purpose: 'PROFILE_CV',
      })
    );

    const result = await service.getSignedAccess('acc', 'cv-key.pdf');

    expect(result.purpose).toBe('PROFILE_CV');
  });

  it('rejects content whose magic bytes do not match the declared PNG type', async () => {
    await expect(
      service.uploadFile('acc', {
        originalname: 'fake.png',
        mimetype: 'image/png',
        size: 100,
        buffer: PDF_BYTES,
      })
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.upload.create).not.toHaveBeenCalled();
  });

  it('rejects content whose magic bytes do not match the declared PDF type', async () => {
    await expect(
      service.uploadFile('acc', {
        originalname: 'fake.pdf',
        mimetype: 'application/pdf',
        size: 100,
        buffer: PNG_BYTES,
      })
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.upload.create).not.toHaveBeenCalled();
  });

  it('rejects an empty buffer declared as an image', async () => {
    await expect(
      service.uploadFile('acc', {
        originalname: 'empty.png',
        mimetype: 'image/png',
        size: 0,
        buffer: Buffer.alloc(0),
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a general PNG whose signature matches', async () => {
    mockPrisma.upload.create.mockResolvedValue(
      storedUpload({ originalName: 'real.png', mimeType: 'image/png' })
    );

    const result = await service.uploadFile('acc', {
      originalname: 'real.png',
      mimetype: 'image/png',
      size: 100,
      buffer: PNG_BYTES,
    });

    expect(result.mimeType).toBe('image/png');
  });
});
