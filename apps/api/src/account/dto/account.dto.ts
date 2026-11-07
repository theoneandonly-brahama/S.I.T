import { Role } from '@prisma/client';

/**
 * AccountResponseDto is the safe representation of an Account returned
 * to callers. It deliberately excludes passwordHash so credentials
 * never leak through service responses.
 */
export class AccountResponseDto {
  id: string;
  email: string;
  role: Role;
  isVerified: boolean;
  isBanned: boolean;
  bannedAt?: Date;
  bannedUntil?: Date;
  banReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
