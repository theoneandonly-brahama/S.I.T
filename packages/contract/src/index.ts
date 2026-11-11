export interface Student {
  id: string;
  email: string;
  address: string;
  confirmed: boolean;
}

export interface Credentials {
  password: string;
}

export interface SessionToken {
  accessToken: string;
  refreshToken: string;
}

// =============================================================================
// Client-facing domain contracts (mirror the API's verified surface)
// ==============================================================================

/**
 * The account roles the API can return. Mirrors the Prisma `Role` enum
 * in apps/api/prisma/schema.prisma — keep both in sync.
 */
export type Role =
  | 'STUDENT'
  | 'UNIVERSITY_EMPLOYEE'
  | 'ADVISER'
  | 'SUB_ADMINISTRATOR'
  | 'PLATFORM_STAFF';

/**
 * The safe account representation returned by /auth/register and
 * /accounts/me: identical to the Account model except that
 * `passwordHash` is never included. Date fields are ISO strings (JSON
 * transport).
 */
export interface AccountResponse {
  id: string;
  email: string;
  role: Role;
  isVerified: boolean;
  isBanned: boolean;
  bannedAt: string | null;
  bannedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Access + refresh pair plus the access-token lifetime in seconds. */
export interface AuthTokens extends SessionToken {
  expiresIn: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Development delivery payload for the email-confirmation token. A real
 * deployment emails the token instead of returning it in the response.
 */
export interface RegistrationConfirmation {
  token: string;
  expiresAt: string;
}

/**
 * POST /auth/register — creates an inactive account and returns its
 * confirmation token. No session is issued until the address is confirmed.
 */
export interface RegisterResponse {
  account: AccountResponse;
  confirmation: RegistrationConfirmation;
}

/** GET /confirmation-token/verify */
export interface VerifyEmailResponse {
  verified: boolean;
}

/** POST /confirmation-token/resend — public, always generic. */
export interface ResendConfirmationRequest {
  email: string;
}

export interface ResendConfirmationResponse {
  message: string;
}

/** POST /auth/login */
export type LoginResponse = AuthTokens;

/**
 * POST /auth/change-password — authenticated. The account id comes
 * from the access token, never the body. Returns 401 with the uniform
 * message when the current password is wrong; 400 when the new
 * password violates policy.
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  success: boolean;
}

/**
 * POST /auth/change-email — authenticated. Updates the account email,
 * resets isVerified, and delivers a fresh confirmation token to the
 * NEW address. The response is the generic anti-enumeration message.
 */
export interface ChangeEmailRequest {
  newEmail: string;
}

export interface ChangeEmailResponse {
  message: string;
}

/** One education entry of the structured profile curriculum. */
export interface CurriculumEntry {
  institution: string;
  degree: string;
  field?: string;
  startYear?: number;
  endYear?: number;
}

/** Metadata of an upload attached to a profile document slot. */
export interface ProfileDocument {
  id: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

/** GET /profile — the owned profile of the authenticated account. */
export interface ProfileResponse {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  diploma?: string;
  university?: string;
  skills: string[];
  links: string[];
  curriculum?: CurriculumEntry[];
  photo?: ProfileDocument;
  cv?: ProfileDocument;
  /** Custom cover colour, or undefined when the brand gradient is used. */
  bannerColor?: string;
  /** Attached diploma file; separate from the `diploma` display label. */
  diplomaDocument?: ProfileDocument;
  /** Attached certification files, in attachment order. */
  certifications: ProfileDocument[];
  createdAt: string;
  updatedAt: string;
}

/** POST /profile — mirrors CreateProfileDto validation bounds. */
export interface CreateProfileRequest {
  firstName: string;
  lastName: string;
  diploma?: string;
  university?: string;
  skills?: string[];
  links?: string[];
  curriculum?: CurriculumEntry[];
  photoUploadId?: string | null;
  cvUploadId?: string | null;
  diplomaUploadId?: string | null;
  certificationUploadIds?: string[];
  bannerColor?: string | null;
}

/** PATCH /profile — all fields optional (patch semantics). */
export type UpdateProfileRequest = Partial<CreateProfileRequest>;

/** Slot selected at upload time. Mirrors the Prisma `UploadPurpose`. */
export type UploadPurpose = 'GENERAL' | 'PROFILE_PHOTO' | 'PROFILE_CV';

/** Metadata row of one stored upload (never includes its path). */
export interface UploadResponse {
  id: string;
  accountId: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  purpose: UploadPurpose;
  createdAt: string;
}

/** GET /uploads/:key/signed-access — time-limited access payload. */
export interface UploadSignedAccessResponse {
  id: string;
  accountId: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  purpose: UploadPurpose;
  accessToken: string;
  expiresAt: string;
}
