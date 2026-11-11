import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

/**
 * RegisterDto is the request body for POST /auth/register.
 *
 * Validation rules:
 * - email: required, must be a valid email format
 * - password: required, 8-128 characters (matches PasswordService policy)
 *
 * Deliberately NO role field: the role is assigned server-side
 * (default STUDENT). Accepting a client-supplied role would allow
 * privilege escalation (e.g. registering as PLATFORM_STAFF).
 * Staff/adviser accounts are created through a separate, authorized flow.
 */
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
