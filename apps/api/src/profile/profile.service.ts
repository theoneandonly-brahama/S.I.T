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
  PROFILE_CREDENTIAL_MAX_SIZE,
  PROFILE_CREDENTIAL_MIME_TYPES,
  PROFILE_CV_MAX_SIZE,
  PROFILE_CV_MIME_TYPES,
  PROFILE_PHOTO_MAX_SIZE,
  PROFILE_PHOTO_MIME_TYPES,
} from '../upload/upload.constants.js';
import { isAllowedBannerColor } from './banner-color.js';

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
  bannerColor: string | null;
  photoUploadId: string | null;
  cvUploadId: string | null;
  diplomaUploadId: string | null;
  createdAt: Date;
  updatedAt: Date;
  photoUpload?: UploadRecord | null;
  cvUpload?: UploadRecord | null;
  diplomaUpload?: UploadRecord | null;
  certifications?: Array<{ upload: UploadRecord }>;
}

type DocumentFields = {
  photoUploadId?: string | null;
  cvUploadId?: string | null;
  diplomaUploadId?: string | null;
  certificationUploadIds?: string[];
};

const PROFILE_INCLUDE = {
  photoUpload: true,
  cvUpload: true,
  diplomaUpload: true,
  certifications: {
    include: { upload: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ProfileInclude;

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

    await this.validateDocuments(accountId, dto);
    this.assertBannerColor(dto.bannerColor);

    const certificationIds = dto.certificationUploadIds ?? [];
    const profile = await this.prisma.profile.create({
      data: {
        account: { connect: { id: accountId } },
        firstName: dto.firstName,
        lastName: dto.lastName,
        diploma: dto.diploma,
        university: dto.university,
        skills: Array.isArray(dto.skills) ? dto.skills : [],
        links: Array.isArray(dto.links) ? dto.links : [],
        curriculum: this.toCurriculumJson(dto.curriculum),
        bannerColor: dto.bannerColor ?? null,
        ...(dto.photoUploadId
          ? { photoUpload: { connect: { id: dto.photoUploadId } } }
          : {}),
        ...(dto.cvUploadId
          ? { cvUpload: { connect: { id: dto.cvUploadId } } }
          : {}),
        ...(dto.diplomaUploadId
          ? { diplomaUpload: { connect: { id: dto.diplomaUploadId } } }
          : {}),
        ...(certificationIds.length > 0
          ? {
              certifications: {
                create: certificationIds.map((uploadId) => ({
                  upload: { connect: { id: uploadId } },
                })),
              },
            }
          : {}),
      },
      include: PROFILE_INCLUDE,
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
      include: PROFILE_INCLUDE,
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
   * A provided document id must reference an upload owned by the same
   * account that satisfies the slot's MIME and size rules. The upload's
   * original purpose is not changed and is not required to match the slot.
   * `null` detaches the slot.
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

    await this.validateDocuments(accountId, dto);
    this.assertBannerColor(dto.bannerColor);

    const data: Prisma.ProfileUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.diploma !== undefined) data.diploma = dto.diploma;
    if (dto.university !== undefined) data.university = dto.university;
    if (Array.isArray(dto.skills)) data.skills = dto.skills;
    if (Array.isArray(dto.links)) data.links = dto.links;
    if (Array.isArray(dto.curriculum)) {
      data.curriculum = this.toCurriculumJson(dto.curriculum);
    }
    if (dto.bannerColor !== undefined) {
      data.bannerColor = dto.bannerColor;
    }
    if (dto.photoUploadId !== undefined) {
      data.photoUpload = dto.photoUploadId
        ? { connect: { id: dto.photoUploadId } }
        : { disconnect: true };
    }
    if (dto.cvUploadId !== undefined) {
      data.cvUpload = dto.cvUploadId
        ? { connect: { id: dto.cvUploadId } }
        : { disconnect: true };
    }
    if (dto.diplomaUploadId !== undefined) {
      data.diplomaUpload = dto.diplomaUploadId
        ? { connect: { id: dto.diplomaUploadId } }
        : { disconnect: true };
    }
    if (Array.isArray(dto.certificationUploadIds)) {
      data.certifications = {
        deleteMany: {},
        ...(dto.certificationUploadIds.length > 0
          ? {
              create: dto.certificationUploadIds.map((uploadId) => ({
                upload: { connect: { id: uploadId } },
              })),
            }
          : {}),
      };
    }

    const updated = await this.prisma.profile.update({
      where: { accountId },
      data,
      include: PROFILE_INCLUDE,
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
    dto: DocumentFields
  ): Promise<void> {
    if (dto.photoUploadId) {
      const upload = await this.prisma.upload.findUnique({
        where: { id: dto.photoUploadId },
      });
      this.assertDocument(
        upload,
        accountId,
        PROFILE_PHOTO_MIME_TYPES,
        PROFILE_PHOTO_MAX_SIZE,
        'photo'
      );
    }

    if (dto.cvUploadId) {
      const upload = await this.prisma.upload.findUnique({
        where: { id: dto.cvUploadId },
      });
      this.assertDocument(
        upload,
        accountId,
        PROFILE_CV_MIME_TYPES,
        PROFILE_CV_MAX_SIZE,
        'CV'
      );
    }

    if (dto.diplomaUploadId) {
      const upload = await this.prisma.upload.findUnique({
        where: { id: dto.diplomaUploadId },
      });
      this.assertDocument(
        upload,
        accountId,
        PROFILE_CREDENTIAL_MIME_TYPES,
        PROFILE_CREDENTIAL_MAX_SIZE,
        'diploma'
      );
    }

    const certificationIds = dto.certificationUploadIds;
    if (certificationIds && certificationIds.length > 0) {
      const uploads = await this.prisma.upload.findMany({
        where: { id: { in: certificationIds } },
      });
      const byId = new Map(uploads.map((upload) => [upload.id, upload]));
      for (const id of certificationIds) {
        this.assertDocument(
          byId.get(id),
          accountId,
          PROFILE_CREDENTIAL_MIME_TYPES,
          PROFILE_CREDENTIAL_MAX_SIZE,
          'certification'
        );
      }
    }
  }

  /**
   * The upload purpose is advisory once a file exists: a general upload
   * can be attached to any profile slot as long as it belongs to the
   * caller and satisfies that slot's MIME and size rules. This is the
   * explicit product decision behind the "Define as…" menu.
   */
  private assertDocument(
    upload:
      | {
          accountId: string;
          mimeType: string;
          size: number;
        }
      | null
      | undefined,
    accountId: string,
    allowedMimeTypes: readonly string[],
    maxSize: number,
    label: string
  ): void {
    if (
      !upload ||
      upload.accountId !== accountId ||
      !allowedMimeTypes.includes(upload.mimeType) ||
      upload.size > maxSize
    ) {
      throw new BadRequestException(`Invalid ${label} upload.`);
    }
  }

  private assertBannerColor(value?: string | null): void {
    if (value === undefined || value === null) {
      return;
    }
    if (!isAllowedBannerColor(value)) {
      throw new BadRequestException(
        'Choose a mid-tone, reasonably saturated banner colour.'
      );
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
      bannerColor: profile.bannerColor ?? undefined,
      diplomaDocument: profile.diplomaUpload
        ? this.toDocument(profile.diplomaUpload)
        : undefined,
      certifications: (profile.certifications ?? []).map((certification) =>
        this.toDocument(certification.upload)
      ),
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
