import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

/**
 * LoginDto is the request body for POST /auth/login.
 *
 * Validation rules:
 * - email: required, must be a valid email format
 * - password: required, 8-128 characters (matches PasswordService policy)
 */
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
