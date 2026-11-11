import { IsEmail } from 'class-validator';

/**
 * ChangeEmailDto is the request body for POST /auth/change-email.
 *
 * Validation rules:
 * - newEmail: required, must be a valid email format
 *
 * The account id is NOT accepted from the client: it comes from the
 * JwtAuthGuard's verified token (req.user.sub), so a user can only
 * change their own email. The confirmation token is delivered to the
 * NEW address (industry standard: proves ownership of the new inbox).
 */
export class ChangeEmailDto {
  @IsEmail()
  newEmail: string;
}
