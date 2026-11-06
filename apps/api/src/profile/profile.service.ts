import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ProfileResponseDto,
  CreateProfileDto,
  UpdateProfileDto,
} from './dto/profile.dto.js';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a profile for an account. Enforces one-profile-per-account
   * via the @unique constraint on accountId; throws ConflictException
   * if a profile already exists.
   */
  async create(accountId: string, dto: CreateProfileDto): Promise<ProfileResponseDto> {
    const existing = await this.prisma.profile.findUnique({ where: { accountId } });
    if (existing) {
      throw new ConflictException('A profile already exists for this account.');
    }

    const profile = await this.prisma.profile.create({
      data: { accountId, ...dto },
    });

    return this.toResponse(profile);
  }

  /**
   * Finds the profile for an account. Throws NotFoundException if none
   * exists. Ownership is implicit: the profile is looked up by accountId,
   * so only the account's own profile is ever returned.
   */
  async findByAccountId(accountId: string): Promise<ProfileResponseDto> {
    const profile = await this.prisma.profile.findUnique({ where: { accountId } });
    if (!profile) {
      throw new NotFoundException('Profile not found.');
    }
    return this.toResponse(profile);
  }

  /**
   * Updates a profile for an account. Ownership is enforced by looking up
   * the profile via accountId — a caller can only update their own profile.
   * Only provided fields are patched.
   */
  async update(
    accountId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const profile = await this.prisma.profile.findUnique({ where: { accountId } });
    if (!profile) {
      throw new NotFoundException('Profile not found.');
    }

    const updated = await this.prisma.profile.update({
      where: { accountId },
      data: dto,
    });

    return this.toResponse(updated);
  }

  /**
   * Strips no sensitive fields from Profile (none exist), but centralizes
   * the mapping so the response shape is consistent across callers.
   */
  private toResponse(profile: {
    id: string;
    accountId: string;
    firstName: string;
    lastName: string;
    diploma: string | null;
    university: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProfileResponseDto {
    return {
      id: profile.id,
      accountId: profile.accountId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      diploma: profile.diploma ?? undefined,
      university: profile.university ?? undefined,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
