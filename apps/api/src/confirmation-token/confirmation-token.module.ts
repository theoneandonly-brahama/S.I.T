import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ConfirmationTokenService } from './confirmation-token.service.js';

@Module({
  imports: [PrismaModule],
  providers: [ConfirmationTokenService],
  exports: [ConfirmationTokenService],
})
export class ConfirmationTokenModule {}
