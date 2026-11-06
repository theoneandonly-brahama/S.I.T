import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role } from '@prisma/client';
import { AccountResponseDto } from './dto/account.dto.js';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new account. Enforces email uniqueness at the application
   * layer (in addition to the @unique database constraint) so callers
   * receive a clear ConflictException instead of a raw Prisma error.
   */
  async create(email: string, passwordHash: string, role: Role = Role.STUDENT) {
    const existing = await this.prisma.account.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const account = await this.prisma.account.create({
      data: { email, passwordHash, role },
    });

    return this.toResponse(account);
  }

  /** Finds an account by email. Returns null when no account exists. */
  async findByEmail(email: string) {
    return this.prisma.account.findUnique({ where: { email } });
  }

  /** Finds an account by id. Throws NotFoundException when missing. */
  async findById(id: string) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException('Account not found.');
    }
    return account;
  }

  /** Marks an account as email-verified (used by the confirmation flow). */
  async markVerified(id: string) {
    return this.prisma.account.update({
      where: { id },
      data: { isVerified: true },
    });
  }

  /**
   * Sets the ban status of an account. Audit columns (bannedAt, bannedUntil,
   * banReason) are populated so moderation actions are traceable.
   */
  async setBanStatus(
    id: string,
    isBanned: boolean,
    bannedAt?: Date,
    bannedUntil?: Date,
    banReason?: string,
  ) {
    return this.prisma.account.update({
      where: { id },
      data: { isBanned, bannedAt, bannedUntil, banReason },
    });
  }

  /**
   * Strips passwordHash before returning the account to callers.
   * Credentials never leave the service layer in plaintext.
   */
  private toResponse(account: { passwordHash?: string; [key: string]: unknown }): AccountResponseDto {
    const { passwordHash: omitted, ...rest } = account;
    void omitted;
    return rest as unknown as AccountResponseDto;
  }
}
