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
 */
export class CreateProfileDto {
  firstName: string;
  lastName: string;
  diploma?: string;
  university?: string;
}

/**
 * UpdateProfileDto is the input for updating a profile. All fields are
 * optional so callers can patch individual fields.
 */
export class UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  diploma?: string;
  university?: string;
}
