import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role } from '@prisma/client';
import { AccountResponseDto } from './dto/account.dto.js';

@Injectable()
export class AccountService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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

  /**
   * Finds an account by id. Throws NotFoundException when missing.
   * passwordHash is stripped before returning — credentials never
   * leave the service layer (same guarantee as create()).
   */
  async findById(id: string) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException('Account not found.');
    }
    return this.toResponse(account);
  }

  /**
   * Updates mutable account fields (currently email only). Enforces
   * email uniqueness at the application layer so a collision surfaces
   * as ConflictException instead of a raw Prisma error. Returns the
   * safe representation (no passwordHash).
   */
  async update(id: string, dto: { email?: string }): Promise<AccountResponseDto> {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException('Account not found.');
    }

    if (dto.email && dto.email !== account.email) {
      const existing = await this.prisma.account.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException('An account with this email already exists.');
      }
    }

    const updated = await this.prisma.account.update({
      where: { id },
      data: { email: dto.email },
    });

    return this.toResponse(updated);
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
    banReason?: string
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
  private toResponse(account: {
    passwordHash?: string;
    [key: string]: unknown;
  }): AccountResponseDto {
    const { passwordHash: omitted, ...rest } = account;
    void omitted;
    return rest as unknown as AccountResponseDto;
  }
}
