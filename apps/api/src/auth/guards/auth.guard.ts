import {
  ExecutionContext,
  Injectable,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '../token.service.js';

/**
 * JwtAuthGuard validates the Bearer access token on protected routes.
 *
 * It extracts the token from the Authorization header, verifies the JWT
 * signature and expiry via TokenService, and attaches the decoded payload
 * (account id + email) to the request as `req.user`.
 *
 * Unauthenticated requests receive a 401 UnauthorizedException.
 */
@Injectable()
export class JwtAuthGuard {
  constructor(
    @Inject(TokenService) private readonly tokenService: TokenService
  ) {}

  canActivate(context: ExecutionContext): boolean {
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
      request.user = {
        sub: payload.sub,
        email: payload.email,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }
}
