import { IsOptional, IsString } from 'class-validator';

/**
 * CreateTokenDto is the request body for POST /confirmation-token.
 *
 * Currently empty (reserved for future use), but the class-validator
 * decorators establish the pattern for adding fields later.
 */
export class CreateTokenDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
