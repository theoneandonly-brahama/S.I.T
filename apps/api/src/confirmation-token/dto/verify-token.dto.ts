import { IsString } from 'class-validator';

/**
 * VerifyTokenDto is the query string for GET /confirmation-token/verify.
 *
 * Validation rules:
 * - token: required, non-empty string
 */
export class VerifyTokenDto {
  @IsString()
  token: string;
}
