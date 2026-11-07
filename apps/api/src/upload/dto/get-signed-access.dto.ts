import { IsOptional, IsString } from 'class-validator';

/**
 * GetSignedAccessDto is reserved for future query parameters on
 * GET /upload/:key/signed-access (e.g. download format, expiry override).
 */
export class GetSignedAccessDto {
  @IsOptional()
  @IsString()
  format?: string;
}
