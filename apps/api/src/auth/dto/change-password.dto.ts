import { IsString, MinLength, MaxLength } from 'class-validator';

/**
 * ChangePasswordDto is the request body for POST /auth/change-password.
 *
 * Validation rules:
 * - currentPassword: required, 8-128 characters
 * - newPassword: required, 8-128 characters (policy re-checked by
 *   PasswordService inside AuthService.changePassword)
 *
 * The account id is NOT accepted from the client: it comes from the
 * JwtAuthGuard's verified token (req.user.sub), so a user can only
 * change their own password.
 */
export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
