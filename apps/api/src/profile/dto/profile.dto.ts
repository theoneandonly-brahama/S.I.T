import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * One education entry of the structured curriculum. The shape is
 * intentionally small: it covers the institution, the degree and the
 * period, which is what the profile preview needs. A normalized
 * EducationEntry table can replace it later if reporting or search
 * requires querying individual entries.
 */
export class CurriculumEntryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  institution: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  degree: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  field?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  startYear?: number;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  endYear?: number;
}

/**
 * Metadata of an upload attached to a profile slot. The filesystem path
 * and the account relationship are never exposed; the storageKey is the
 * opaque identifier the signed-access endpoint expects.
 */
export class ProfileDocumentDto {
  id: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

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
  skills: string[];
  links: string[];
  curriculum?: CurriculumEntryDto[];
  photo?: ProfileDocumentDto;
  cv?: ProfileDocumentDto;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CreateProfileDto is the input for creating a profile.
 *
 * Every field carries an explicit class-validator decorator because the
 * global ValidationPipe runs with `whitelist: true`: properties without
 * decorators are silently stripped from the payload.
 *
 * `photoUploadId` and `cvUploadId` are references to uploads already
 * owned by the account. The service re-checks ownership, purpose, MIME
 * type and size before attaching them.
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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(50, { each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    },
    { each: true }
  )
  @MaxLength(2048, { each: true })
  links?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CurriculumEntryDto)
  curriculum?: CurriculumEntryDto[];

  @IsOptional()
  @IsUUID()
  photoUploadId?: string | null;

  @IsOptional()
  @IsUUID()
  cvUploadId?: string | null;
}

/**
 * UpdateProfileDto is the input for updating a profile. All fields are
 * optional so callers can patch individual fields. Sending
 * `photoUploadId: null` or `cvUploadId: null` detaches the corresponding
 * document; omitting the field leaves it unchanged.
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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(50, { each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    },
    { each: true }
  )
  @MaxLength(2048, { each: true })
  links?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CurriculumEntryDto)
  curriculum?: CurriculumEntryDto[];

  @IsOptional()
  @IsUUID()
  photoUploadId?: string | null;

  @IsOptional()
  @IsUUID()
  cvUploadId?: string | null;
}
