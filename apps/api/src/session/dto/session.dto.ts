/**
 * SessionResponseDto is the safe representation of a Session returned
 * to callers. It excludes internal Prisma metadata and only exposes
 * fields needed by the session lifecycle.
 */
export class SessionResponseDto {
  id: string;
  accountId: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
}
