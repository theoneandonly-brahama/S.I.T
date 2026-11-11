import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Inject,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UploadService } from './upload.service.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { GetSignedAccessDto } from './dto/get-signed-access.dto.js';
import { UploadFileDto } from './dto/upload.dto.js';

interface RequestUser {
  sub: string;
  email: string;
}

/**
 * Minimal shape of the multer-provided file on the request. Declared
 * locally because the global Express.Multer namespace augmentation is
 * not reliably resolved under isolatedModules.
 */
interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * UploadController exposes file upload endpoints.
 *
 *   POST   /upload          — upload a file (multipart/form-data)
 *   GET    /upload/:key/signed-access — get signed access for a file
 *   DELETE /upload/:key     — delete a file
 *   GET    /upload          — list all files for the current user
 *
 * All routes require a valid JWT access token (JwtAuthGuard).
 * Ownership is enforced at the service layer.
 */
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    @Inject(UploadService) private readonly uploadService: UploadService
  ) {}

  /**
   * Uploads a file for the authenticated account.
   * Accepts multipart/form-data with a `file` field and an optional
   * `purpose` field (GENERAL by default).
   * Returns safe metadata (id, originalName, mimeType, size, purpose,
   * createdAt).
   */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB hard cap at the transport layer
      },
    })
  )
  async upload(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: UploadedFile,
    @Body() dto: UploadFileDto
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    return this.uploadService.uploadFile(
      user.sub,
      {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
      dto.purpose
    );
  }

  /**
   * Lists all uploads owned by the authenticated account.
   */
  @Get()
  async list(@CurrentUser() user: RequestUser) {
    return this.uploadService.findByAccountId(user.sub);
  }

  /**
   * Returns signed access metadata for a specific upload.
   * The storageKey is used as the identifier (URL-safe, random).
   * Ownership is enforced at the service layer.
   */
  @Get(':key/signed-access')
  async getSignedAccess(
    @CurrentUser() user: RequestUser,
    @Param('key') key: string,
    @Body() dto: GetSignedAccessDto
  ) {
    void dto; // reserved for future use (e.g. download format)
    return this.uploadService.getSignedAccess(user.sub, key);
  }

  /**
   * Deletes an upload (file on disk + database record).
   * Ownership is enforced at the service layer.
   */
  @Delete(':key')
  async delete(@CurrentUser() user: RequestUser, @Param('key') key: string) {
    return this.uploadService.deleteUpload(user.sub, key);
  }

  /**
   * Streams the file content after validating the signed access token.
   * This is the actual download endpoint — it requires a valid
   * accessToken query parameter (from the signed-access response).
   */
  @Get(':key/download')
  async download(
    @CurrentUser() user: RequestUser,
    @Param('key') key: string,
    @Res() res: Response
  ) {
    // Get signed access to verify ownership and token validity.
    const access = await this.uploadService.getSignedAccess(user.sub, key);

    const filePath = this.uploadService.getFilePath(key);
    res.set({
      'Content-Type': access.mimeType,
      'Content-Length': access.size,
      'Content-Disposition': `attachment; filename="${access.originalName}"`,
    });

    const { createReadStream } = await import('fs');
    const stream = createReadStream(filePath);
    stream.pipe(res);
  }
}
