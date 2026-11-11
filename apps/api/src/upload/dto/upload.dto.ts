import { IsEnum, IsOptional } from 'class-validator';
import { UploadPurpose } from '@prisma/client';

/**
 * UploadFileDto is the multipart text body for POST /upload.
 * `purpose` selects the slot policy; omitting it means GENERAL.
 */
export class UploadFileDto {
  @IsOptional()
  @IsEnum(UploadPurpose)
  purpose?: UploadPurpose;
}

/**
 * UploadResponseDto is the safe representation of an Upload returned
 * to callers after a successful upload. It exposes metadata but not
 * the filesystem path (which is internal).
 */
export class UploadResponseDto {
  id: string;
  accountId: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  purpose: UploadPurpose;
  createdAt: Date;
}

/**
 * UploadSignedAccessDto is returned when requesting signed access to
 * a private upload. It contains the metadata and a signed access token
 * that the controller can use to build a time-limited download URL.
 */
export class UploadSignedAccessDto {
  id: string;
  accountId: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  purpose: UploadPurpose;
  accessToken: string;
  expiresAt: Date;
}

/**
 * Allowed MIME types for general uploads. Keep this conservative:
 * images and PDFs only. Executables, scripts, and archives are rejected.
 * Profile slots narrow this further in `upload.constants.ts`.
 */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
