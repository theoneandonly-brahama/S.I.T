import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TokenModule } from '../auth/token.module.js';
import { ProfileService } from './profile.service.js';
import { ProfileController } from './profile.controller.js';

@Module({
  // TokenModule supplies TokenService for JwtAuthGuard instead of the
  // whole AuthModule, keeping the module graph acyclic.
  imports: [PrismaModule, TokenModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
