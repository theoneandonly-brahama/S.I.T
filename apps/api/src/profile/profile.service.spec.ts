import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ProfileService } from './profile.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PROFILE_CV_MAX_SIZE,
  PROFILE_PHOTO_MAX_SIZE,
} from '../upload/upload.constants.js';

const mockPrisma = {
  profile: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  upload: {
    findUnique: vi.fn(),
  },
} as unknown as PrismaService;

const now = new Date();

const baseProfile = {
  id: '1',
  accountId: 'acc',
  firstName: 'Ada',
  lastName: 'Lovelace',
  diploma: null,
  university: null,
  skills: [],
  links: [],
  curriculum: null,
  photoUploadId: null,
  cvUploadId: null,
  createdAt: now,
  updatedAt: now,
};

const photoUpload = {
  id: 'photo-1',
  originalName: 'me.png',
  storageKey: 'photo-key.png',
  mimeType: 'image/png',
  size: 1024,
  createdAt: now,
};

const cvUpload = {
  id: 'cv-1',
  originalName: 'cv.pdf',
  storageKey: 'cv-key.pdf',
  mimeType: 'application/pdf',
  size: 2048,
  createdAt: now,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ProfileService', () => {
  const service = new ProfileService(mockPrisma);

  it('throws ConflictException when profile already exists', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      id: '1',
      accountId: 'acc',
    });
    await expect(
      service.create('acc', { firstName: 'Ada', lastName: 'Lovelace' })
    ).rejects.toThrow(ConflictException);
  });

  it('creates profile and maps null optional fields to undefined', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    mockPrisma.profile.create.mockResolvedValue({
      ...baseProfile,
    });

    const result = await service.create('acc', {
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    expect(result.diploma).toBeUndefined();
    expect(result.university).toBeUndefined();
    expect(result.skills).toEqual([]);
    expect(result.links).toEqual([]);
    expect(result.curriculum).toBeUndefined();
    expect(result.photo).toBeUndefined();
    expect(result.cv).toBeUndefined();
    expect(result.firstName).toBe('Ada');
  });

  it('creates a profile with skills, links, curriculum and a valid photo', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    mockPrisma.upload.findUnique.mockResolvedValue({
      id: 'photo-1',
      accountId: 'acc',
      purpose: 'PROFILE_PHOTO',
      mimeType: 'image/png',
      size: 1024,
    });
    mockPrisma.profile.create.mockResolvedValue({
      ...baseProfile,
      skills: ['TypeScript'],
      links: ['https://example.com'],
      curriculum: [{ institution: 'MIT', degree: 'BSc' }],
      photoUploadId: 'photo-1',
      photoUpload,
    });

    const result = await service.create('acc', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      skills: ['TypeScript'],
      links: ['https://example.com'],
      curriculum: [{ institution: 'MIT', degree: 'BSc' }],
      photoUploadId: 'photo-1',
    });

    expect(mockPrisma.upload.findUnique).toHaveBeenCalledWith({
      where: { id: 'photo-1' },
    });
    expect(mockPrisma.profile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        skills: ['TypeScript'],
        links: ['https://example.com'],
        curriculum: [{ institution: 'MIT', degree: 'BSc' }],
        photoUploadId: 'photo-1',
      }),
      include: { photoUpload: true, cvUpload: true },
    });
    expect(result.skills).toEqual(['TypeScript']);
    expect(result.links).toEqual(['https://example.com']);
    expect(result.curriculum).toEqual([{ institution: 'MIT', degree: 'BSc' }]);
    expect(result.photo?.id).toBe('photo-1');
  });

  it('rejects a photo upload owned by another account', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    mockPrisma.upload.findUnique.mockResolvedValue({
      id: 'photo-1',
      accountId: 'other',
      purpose: 'PROFILE_PHOTO',
      mimeType: 'image/png',
      size: 1024,
    });

    await expect(
      service.create('acc', {
        firstName: 'Ada',
        lastName: 'Lovelace',
        photoUploadId: 'photo-1',
      })
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.profile.create).not.toHaveBeenCalled();
  });

  it('rejects a photo upload carrying the wrong purpose', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    mockPrisma.upload.findUnique.mockResolvedValue({
      id: 'cv-1',
      accountId: 'acc',
      purpose: 'PROFILE_CV',
      mimeType: 'application/pdf',
      size: 1024,
    });

    await expect(
      service.create('acc', {
        firstName: 'Ada',
        lastName: 'Lovelace',
        photoUploadId: 'cv-1',
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a photo larger than 2 MB', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    mockPrisma.upload.findUnique.mockResolvedValue({
      id: 'photo-1',
      accountId: 'acc',
      purpose: 'PROFILE_PHOTO',
      mimeType: 'image/png',
      size: PROFILE_PHOTO_MAX_SIZE + 1,
    });

    await expect(
      service.create('acc', {
        firstName: 'Ada',
        lastName: 'Lovelace',
        photoUploadId: 'photo-1',
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a photo with a disallowed MIME type', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    mockPrisma.upload.findUnique.mockResolvedValue({
      id: 'photo-1',
      accountId: 'acc',
      purpose: 'PROFILE_PHOTO',
      mimeType: 'application/pdf',
      size: 1024,
    });

    await expect(
      service.create('acc', {
        firstName: 'Ada',
        lastName: 'Lovelace',
        photoUploadId: 'photo-1',
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a PDF CV at the 5 MB limit', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    mockPrisma.upload.findUnique.mockResolvedValue({
      id: 'cv-1',
      accountId: 'acc',
      purpose: 'PROFILE_CV',
      mimeType: 'application/pdf',
      size: PROFILE_CV_MAX_SIZE,
    });
    mockPrisma.profile.create.mockResolvedValue({
      ...baseProfile,
      cvUploadId: 'cv-1',
      cvUpload,
    });

    const result = await service.create('acc', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      cvUploadId: 'cv-1',
    });

    expect(result.cv?.id).toBe('cv-1');
    expect(result.cv?.mimeType).toBe('application/pdf');
  });

  it('throws NotFoundException when profile missing', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    await expect(service.findByAccountId('acc')).rejects.toThrow(
      NotFoundException
    );
  });

  it('returns skills, links, curriculum and attached documents', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      ...baseProfile,
      skills: ['NestJS'],
      links: ['https://sit.tn'],
      curriculum: [{ institution: 'MIT', degree: 'BSc' }],
      photoUploadId: 'photo-1',
      cvUploadId: 'cv-1',
      photoUpload,
      cvUpload,
    });

    const result = await service.findByAccountId('acc');

    expect(mockPrisma.profile.findUnique).toHaveBeenCalledWith({
      where: { accountId: 'acc' },
      include: { photoUpload: true, cvUpload: true },
    });
    expect(result.skills).toEqual(['NestJS']);
    expect(result.links).toEqual(['https://sit.tn']);
    expect(result.curriculum).toEqual([{ institution: 'MIT', degree: 'BSc' }]);
    expect(result.photo?.storageKey).toBe('photo-key.png');
    expect(result.cv?.mimeType).toBe('application/pdf');
  });

  it('updates only provided fields (patch semantics)', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      id: '1',
      accountId: 'acc',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    mockPrisma.profile.update.mockResolvedValue({
      ...baseProfile,
      lastName: 'Lovelace Updated',
    });

    const result = await service.update('acc', {
      lastName: 'Lovelace Updated',
    });

    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { accountId: 'acc' },
      data: { lastName: 'Lovelace Updated' },
      include: { photoUpload: true, cvUpload: true },
    });
    expect(result.lastName).toBe('Lovelace Updated');
  });

  it('detaches the photo when photoUploadId is null', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ ...baseProfile });
    mockPrisma.profile.update.mockResolvedValue({
      ...baseProfile,
      photoUploadId: null,
      photoUpload: null,
    });

    const result = await service.update('acc', { photoUploadId: null });

    expect(mockPrisma.upload.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { accountId: 'acc' },
      data: { photoUploadId: null },
      include: { photoUpload: true, cvUpload: true },
    });
    expect(result.photo).toBeUndefined();
  });

  it('rejects a CV owned by another account on update', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ ...baseProfile });
    mockPrisma.upload.findUnique.mockResolvedValue({
      id: 'cv-1',
      accountId: 'other',
      purpose: 'PROFILE_CV',
      mimeType: 'application/pdf',
      size: 1024,
    });

    await expect(service.update('acc', { cvUploadId: 'cv-1' })).rejects.toThrow(
      BadRequestException
    );
    expect(mockPrisma.profile.update).not.toHaveBeenCalled();
  });
});
