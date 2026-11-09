import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AccountModule } from '../account/account.module.js';
import { TokenModule } from '../auth/token.module.js';
import { UploadService } from './upload.service.js';
import { UploadController } from './upload.controller.js';

@Module({
  // AccountModule supplies AccountService and TokenModule supplies
  // TokenService for JwtAuthGuard instead of the whole AuthModule,
  // keeping the module graph acyclic. AccountModule does not import
  // UploadModule, so this stays acyclic.
  imports: [PrismaModule, AccountModule, TokenModule],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
