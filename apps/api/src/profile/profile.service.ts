import {
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ProfileResponseDto,
  ProfileDocumentDto,
  CreateProfileDto,
  UpdateProfileDto,
  CurriculumEntryDto,
} from './dto/profile.dto.js';
import {
  PROFILE_CV_MAX_SIZE,
  PROFILE_CV_MIME_TYPES,
  PROFILE_PHOTO_MAX_SIZE,
  PROFILE_PHOTO_MIME_TYPES,
} from '../upload/upload.constants.js';

interface UploadRecord {
  id: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

interface ProfileRecord {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  diploma: string | null;
  university: string | null;
  skills: string[] | null;
  links: string[] | null;
  curriculum: Prisma.JsonValue | null;
  photoUploadId: string | null;
  cvUploadId: string | null;
  createdAt: Date;
  updatedAt: Date;
  photoUpload?: UploadRecord | null;
  cvUpload?: UploadRecord | null;
}

@Injectable()
export class ProfileService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Creates a profile for an account. Enforces one-profile-per-account
   * via the @unique constraint on accountId; throws ConflictException
   * if a profile already exists.
   */
  async create(
    accountId: string,
    dto: CreateProfileDto
  ): Promise<ProfileResponseDto> {
    const existing = await this.prisma.profile.findUnique({
      where: { accountId },
    });
    if (existing) {
      throw new ConflictException('A profile already exists for this account.');
    }

    await this.validateDocuments(accountId, dto.photoUploadId, dto.cvUploadId);

    const profile = await this.prisma.profile.create({
      data: {
        accountId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        diploma: dto.diploma,
        university: dto.university,
        skills: Array.isArray(dto.skills) ? dto.skills : [],
        links: Array.isArray(dto.links) ? dto.links : [],
        curriculum: this.toCurriculumJson(dto.curriculum),
        photoUploadId: dto.photoUploadId ?? null,
        cvUploadId: dto.cvUploadId ?? null,
      },
      include: { photoUpload: true, cvUpload: true },
    });

    return this.toResponse(profile);
  }

  /**
   * Finds the profile for an account. Throws NotFoundException if none
   * exists. Ownership is implicit: the profile is looked up by accountId,
   * so only the account's own profile is ever returned.
   */
  async findByAccountId(accountId: string): Promise<ProfileResponseDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { accountId },
      include: { photoUpload: true, cvUpload: true },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found.');
    }
    return this.toResponse(profile);
  }

  /**
   * Updates a profile for an account. Ownership is enforced by looking up
   * the profile via accountId — a caller can only update their own profile.
   * Only provided fields are patched.
   *
   * A provided `photoUploadId` / `cvUploadId` must reference an upload that
   * belongs to the same account and carries the matching purpose, MIME type
   * and size. `null` detaches the slot.
   */
  async update(
    accountId: string,
    dto: UpdateProfileDto
  ): Promise<ProfileResponseDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { accountId },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found.');
    }

    await this.validateDocuments(accountId, dto.photoUploadId, dto.cvUploadId);

    const data: Prisma.ProfileUncheckedUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.diploma !== undefined) data.diploma = dto.diploma;
    if (dto.university !== undefined) data.university = dto.university;
    if (Array.isArray(dto.skills)) data.skills = dto.skills;
    if (Array.isArray(dto.links)) data.links = dto.links;
    if (Array.isArray(dto.curriculum)) {
      data.curriculum = this.toCurriculumJson(dto.curriculum);
    }
    if (dto.photoUploadId !== undefined) {
      data.photoUploadId = dto.photoUploadId;
    }
    if (dto.cvUploadId !== undefined) {
      data.cvUploadId = dto.cvUploadId;
    }

    const updated = await this.prisma.profile.update({
      where: { accountId },
      data,
      include: { photoUpload: true, cvUpload: true },
    });

    return this.toResponse(updated);
  }

  /**
   * Re-validates every attached document. The upload endpoint is the
   * primary enforcement point, but a profile write is a second trust
   * boundary: an upload could have been created before the slot rules
   * existed, or its purpose could have been supplied incorrectly.
   *
   * All failures use the same message so a caller cannot distinguish
   * "missing" from "not yours" from "wrong type".
   */
  private async validateDocuments(
    accountId: string,
    photoUploadId?: string | null,
    cvUploadId?: string | null
  ): Promise<void> {
    if (photoUploadId) {
      const upload = await this.prisma.upload.findUnique({
        where: { id: photoUploadId },
      });
      this.assertDocument(
        upload,
        accountId,
        'PROFILE_PHOTO',
        PROFILE_PHOTO_MIME_TYPES,
        PROFILE_PHOTO_MAX_SIZE,
        'photo'
      );
    }

    if (cvUploadId) {
      const upload = await this.prisma.upload.findUnique({
        where: { id: cvUploadId },
      });
      this.assertDocument(
        upload,
        accountId,
        'PROFILE_CV',
        PROFILE_CV_MIME_TYPES,
        PROFILE_CV_MAX_SIZE,
        'CV'
      );
    }
  }

  private assertDocument(
    upload:
      | {
          accountId: string;
          purpose: string;
          mimeType: string;
          size: number;
        }
      | null
      | undefined,
    accountId: string,
    purpose: 'PROFILE_PHOTO' | 'PROFILE_CV',
    allowedMimeTypes: readonly string[],
    maxSize: number,
    label: string
  ): void {
    if (!upload) {
      throw new BadRequestException(`Invalid ${label} upload.`);
    }

    const valid =
      upload.accountId === accountId &&
      upload.purpose === purpose &&
      allowedMimeTypes.includes(upload.mimeType) &&
      upload.size <= maxSize;

    if (!valid) {
      throw new BadRequestException(`Invalid ${label} upload.`);
    }
  }

  /**
   * Converts the validated DTO entries to plain JSON objects. Prisma
   * serializes the result into the `curriculum` JSONB column.
   */
  private toCurriculumJson(
    curriculum?: CurriculumEntryDto[]
  ): Prisma.InputJsonValue | undefined {
    if (!Array.isArray(curriculum)) {
      return undefined;
    }

    return curriculum.map((entry) => ({
      institution: entry.institution,
      degree: entry.degree,
      ...(entry.field !== undefined ? { field: entry.field } : {}),
      ...(entry.startYear !== undefined ? { startYear: entry.startYear } : {}),
      ...(entry.endYear !== undefined ? { endYear: entry.endYear } : {}),
    })) as Prisma.InputJsonValue;
  }

  /**
   * Strips no sensitive fields from Profile (none exist), but centralizes
   * the mapping so the response shape is consistent across callers.
   */
  private toResponse(profile: ProfileRecord): ProfileResponseDto {
    return {
      id: profile.id,
      accountId: profile.accountId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      diploma: profile.diploma ?? undefined,
      university: profile.university ?? undefined,
      skills: profile.skills ?? [],
      links: profile.links ?? [],
      curriculum: Array.isArray(profile.curriculum)
        ? (profile.curriculum as unknown as CurriculumEntryDto[])
        : undefined,
      photo: profile.photoUpload
        ? this.toDocument(profile.photoUpload)
        : undefined,
      cv: profile.cvUpload ? this.toDocument(profile.cvUpload) : undefined,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  private toDocument(upload: UploadRecord): ProfileDocumentDto {
    return {
      id: upload.id,
      originalName: upload.originalName,
      storageKey: upload.storageKey,
      mimeType: upload.mimeType,
      size: upload.size,
      createdAt: upload.createdAt,
    };
  }
}
