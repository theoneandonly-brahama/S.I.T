/**
 * UpdateAccountDto is the request body for PATCH /accounts/me.
 *
 * Intentionally has NO updatable fields in Release 1: email changes
 * must go through POST /auth/change-email (which resets isVerified
 * and issues a re-verification token), and password changes through
 * POST /auth/change-password. Keeping email on this DTO would
 * bypass re-verification entirely.
 *
 * With the global ValidationPipe set to forbidNonWhitelisted, any
 * property sent here (including `email`) is rejected with 400.
 * The class is kept as the extension point for future patchable
 * fields.
 */
export class UpdateAccountDto {}
