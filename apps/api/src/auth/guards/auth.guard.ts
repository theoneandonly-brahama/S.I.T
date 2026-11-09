import {
  ExecutionContext,
  Injectable,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountService } from '../../account/account.service.js';
import { TokenService } from '../token.service.js';

/**
 * JwtAuthGuard validates the Bearer access token on protected routes.
 *
 * It extracts the token from the Authorization header, verifies the JWT
 * signature and expiry via TokenService, fetches the associated account,
 * and checks that the account is verified and not banned. Unauthenticated
 * requests receive a 401 UnauthorizedException.
 *
 * Anti-enumeration: the failure message is identical regardless of whether
 * the account does not exist, the password is wrong, the account is
 * unverified, or the account is banned — no state signal is leaked.
 */
@Injectable()
export class JwtAuthGuard {
  constructor(
    @Inject(AccountService) private readonly accountService: AccountService,
    @Inject(TokenService) private readonly tokenService: TokenService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header.'
      );
    }

    const token = authHeader.slice(7); // strip 'Bearer '

    try {
      const payload = this.tokenService.verifyAccessToken(token);
      const account = await this.accountService.findById(payload.sub);

      if (!account || !account.isVerified || account.isBanned) {
        // Uniform failure: do not confirm that a credential pair belongs to
        // an unverified, missing, or banned account. Same message for all cases.
        throw new UnauthorizedException('Invalid credentials.');
      }

      request.user = {
        sub: account.id,
        email: account.email,
      };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }
}
