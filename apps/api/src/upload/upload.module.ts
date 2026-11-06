import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UploadService } from './upload.service.js';

@Module({
  imports: [PrismaModule],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
