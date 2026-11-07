import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * ProfileResponseDto is the safe representation of a Profile returned
 * to callers. It exposes only profile fields — the account relationship
 * is implicit through the authenticated context.
 */
export class ProfileResponseDto {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  diploma?: string;
  university?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CreateProfileDto is the input for creating a profile.
 *
 * Every field carries an explicit class-validator decorator because the
 * global ValidationPipe runs with `whitelist: true`: properties without
 * decorators are silently stripped from the payload.
 */
export class CreateProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  diploma?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  university?: string;
}

/**
 * UpdateProfileDto is the input for updating a profile. All fields are
 * optional so callers can patch individual fields.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  diploma?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  university?: string;
}
