import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the authenticated user payload from the request (set by
 * JwtAuthGuard via `req.user`).
 *
 * Usage:
 *   @Get('me')
 *   getMe(@CurrentUser() user: { sub: string; email: string }) {
 *     return user;
 *   }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    return request.user;
  }
);
