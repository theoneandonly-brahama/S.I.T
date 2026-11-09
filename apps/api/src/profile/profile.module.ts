import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AccountModule } from '../account/account.module.js';
import { TokenModule } from '../auth/token.module.js';
import { ProfileService } from './profile.service.js';
import { ProfileController } from './profile.controller.js';

@Module({
  // AccountModule supplies AccountService and TokenModule supplies
  // TokenService for JwtAuthGuard instead of the whole AuthModule,
  // keeping the module graph acyclic. AccountModule does not import
  // ProfileModule, so this stays acyclic.
  imports: [PrismaModule, AccountModule, TokenModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
