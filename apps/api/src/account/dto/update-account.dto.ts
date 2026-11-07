import { IsEmail, IsOptional } from 'class-validator';

/**
 * UpdateAccountDto is the request body for PATCH /accounts/me.
 *
 * Validation rules:
 * - email: optional, must be a valid email format if provided
 *
 * All fields are optional so callers can patch individual fields.
 */
export class UpdateAccountDto {
  @IsOptional()
  @IsEmail()
  email?: string;
}
