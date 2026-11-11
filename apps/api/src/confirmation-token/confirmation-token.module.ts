import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TokenModule } from '../auth/token.module.js';
import { ConfirmationTokenService } from './confirmation-token.service.js';
import { ConfirmationDeliveryService } from './confirmation-delivery.service.js';
import { ConfirmationTokenController } from './confirmation-token.controller.js';
import { AccountModule } from '../account/account.module.js';

@Module({
  // AccountModule for the JwtAuthGuard's AccountService (the create
  // route is guarded) + TokenModule for its TokenService — AuthModule
  // itself is not needed, and importing it would risk a circular
  // graph. AccountModule does not import ConfirmationTokenModule, so
  // this stays acyclic.
  imports: [PrismaModule, AccountModule, TokenModule],
  controllers: [ConfirmationTokenController],
  providers: [ConfirmationTokenService, ConfirmationDeliveryService],
  exports: [ConfirmationTokenService, ConfirmationDeliveryService],
})
export class ConfirmationTokenModule {}
