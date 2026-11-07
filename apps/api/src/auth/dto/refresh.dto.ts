import { IsString } from 'class-validator';

/**
 * RefreshDto is the request body for POST /auth/refresh and POST /auth/logout.
 *
 * Validation rules:
 * - refreshToken: required, non-empty string
 */
export class RefreshDto {
  @IsString()
  refreshToken: string;
}
