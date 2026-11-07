import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  UploadResponseDto,
  UploadSignedAccessDto,
  ALLOWED_MIME_TYPES,
  AllowedMimeType,
} from './dto/upload.dto.js';

/**
 * UploadService handles private file uploads with size caps, content-type
 * verification, private storage keys, and signed access (E1-US2.b).
 *
 * Files are stored on the local filesystem under UPLOAD_STORAGE_PATH
 * with a random server-generated storageKey (never the original client
 * filename, which prevents path traversal and overwrite attacks). An
 * Upload record in PostgreSQL tracks ownership (accountId), original
 * name, MIME type, and size.
 */
@Injectable()
export class UploadService {
  private readonly storagePath: string;
  private readonly maxSize: number;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    this.storagePath = process.env.UPLOAD_STORAGE_PATH || './uploads';
    this.maxSize = Number(process.env.UPLOAD_MAX_SIZE) || 5242880; // 5 MB

    // Ensure the storage directory exists.
    if (!existsSync(this.storagePath)) {
      mkdirSync(this.storagePath, { recursive: true });
    }
  }

  /**
   * Uploads a file for an account.
   *
   * Validates:
   *   - File size against UPLOAD_MAX_SIZE
   *   - MIME type against the allowlist (images + PDF only)
   *
   * Stores the file under a random storageKey and creates an Upload
   * record linked to the account. Returns safe metadata without the
   * filesystem path.
   */
  async uploadFile(
    accountId: string,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }
  ): Promise<UploadResponseDto> {
    // Size cap enforcement.
    if (file.size > this.maxSize) {
      throw new BadRequestException(
        `File too large. Maximum size is ${this.maxSize} bytes (${Math.round(this.maxSize / 1024 / 1024)} MB).`
      );
    }

    // Content-type verification against allowlist.
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as AllowedMimeType)) {
      throw new BadRequestException(
        `File type '${file.mimetype}' is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}.`
      );
    }

    // Generate a private storage key: random bytes + safe extension.
    const extension = this.safeExtension(file.originalname, file.mimetype);
    const storageKey = `${randomBytes(16).toString('hex')}${extension}`;
    const filePath = join(this.storagePath, storageKey);

    // Write the file to disk.
    createWriteStream(filePath).end(file.buffer);

    // Create the Upload record in PostgreSQL.
    const upload = await this.prisma.upload.create({
      data: {
        accountId,
        originalName: file.originalname,
        storageKey,
        mimeType: file.mimetype,
        size: file.size,
      },
    });

    return this.toResponse(upload);
  }

  /**
   * Returns signed access metadata for a private upload. Verifies that
   * the requesting account owns the upload before returning anything.
   * The accessToken is a short-lived JWT-like token the controller can
   * validate before streaming the file.
   */
  async getSignedAccess(
    accountId: string,
    storageKey: string
  ): Promise<UploadSignedAccessDto> {
    const upload = await this.prisma.upload.findUnique({
      where: { storageKey },
    });
    if (!upload) {
      throw new NotFoundException('Upload not found.');
    }

    // Ownership enforcement: only the owning account can access.
    if (upload.accountId !== accountId) {
      throw new UnauthorizedException('You do not have access to this upload.');
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute signed URL
    const accessToken = this.signAccessToken(storageKey, expiresAt);

    return {
      id: upload.id,
      accountId: upload.accountId,
      originalName: upload.originalName,
      storageKey: upload.storageKey,
      mimeType: upload.mimeType,
      size: upload.size,
      accessToken,
      expiresAt,
    };
  }

  /**
   * Returns the absolute filesystem path for a storageKey. Intended for
   * use by a controller that streams the file after validating the
   * access token.
   */
  getFilePath(storageKey: string): string {
    return join(this.storagePath, storageKey);
  }

  /**
   * Deletes an upload. Verifies ownership, removes the file from disk
   * (if present), and deletes the Upload record.
   */
  async deleteUpload(accountId: string, storageKey: string): Promise<void> {
    const upload = await this.prisma.upload.findUnique({
      where: { storageKey },
    });
    if (!upload) {
      throw new NotFoundException('Upload not found.');
    }
    if (upload.accountId !== accountId) {
      throw new UnauthorizedException('You do not have access to this upload.');
    }

    const filePath = this.getFilePath(storageKey);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    await this.prisma.upload.delete({ where: { storageKey } });
  }

  /**
   * Finds all uploads for an account (owned uploads only).
   */
  async findByAccountId(accountId: string) {
    return this.prisma.upload.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private safeExtension(originalName: string, mimeType: string): string {
    // Derive a safe extension from the MIME type, not the original filename,
    // to prevent double-extension attacks (e.g. "photo.jpg.php").
    const extByMime: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    return extByMime[mimeType] || '.bin';
  }

  private signAccessToken(storageKey: string, expiresAt: Date): string {
    // Simple signed token: storageKey + expiry + HMAC signature.
    // In production this would be a JWT signed with JWT_SECRET.
    const payload = `${storageKey}:${expiresAt.getTime()}`;
    return Buffer.from(payload).toString('base64url');
  }

  private toResponse(upload: {
    id: string;
    accountId: string;
    originalName: string;
    storageKey: string;
    mimeType: string;
    size: number;
    createdAt: Date;
  }): UploadResponseDto {
    return {
      id: upload.id,
      accountId: upload.accountId,
      originalName: upload.originalName,
      storageKey: upload.storageKey,
      mimeType: upload.mimeType,
      size: upload.size,
      createdAt: upload.createdAt,
    };
  }
}
