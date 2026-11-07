import { Module } from '@nestjs/common';
import { TokenService } from './token.service.js';

/**
 * TokenModule provides TokenService (JWT signing and decoding) to every
 * feature module that guards its routes with JwtAuthGuard.
 *
 * It exists as a dedicated module so feature modules (Account, Session,
 * Profile, Upload, ConfirmationToken) can depend on the token slice of
 * authentication WITHOUT importing AuthModule. AuthModule imports
 * AccountModule and SessionModule for the login/session flows, so those
 * feature modules importing AuthModule would create circular module
 * graphs. Circular imports are resolved differently per module system:
 * under ESM evaluation order one side of the cycle observes the other
 * as undefined when the @Module decorator runs, and the application
 * fails during boot.
 *
 * TokenModule depends on no feature module, so the graph stays acyclic:
 *   TokenModule <- AuthModule <- AccountModule / SessionModule
 *   TokenModule <- every guarded feature module
 */
@Module({
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}
