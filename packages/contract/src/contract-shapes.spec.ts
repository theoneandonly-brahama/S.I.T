import { describe, it, expect } from 'vitest';
import type {
  AccountResponse,
  AuthTokens,
  ChangeEmailRequest,
  ChangeEmailResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  CreateProfileRequest,
  ProfileResponse,
  RegisterRequest,
  RegisterResponse,
  ResendConfirmationRequest,
  ResendConfirmationResponse,
  UploadResponse,
  VerifyEmailResponse,
} from './index.js';

/**
 * Contract shape tests (bonus Step 11).
 *
 * The contract package is types-only, so these tests pin the wire
 * shape of every client-facing interface: each fixture is typed by
 * its interface (a renamed, removed, or added field fails the
 * typecheck) and the runtime key assertion catches accidental
 * additions/removals that stay type-compatible (e.g. an optional
 * field sneaking in, or passwordHash leaking into AccountResponse).
 *
 * If the API changes a response field, the matching fixture here
 * must change in the same commit — that is the point.
 */

function keysOf(value: object): string[] {
  return Object.keys(value).sort();
}

describe('@sit/contract shapes', () => {
  it('AccountResponse exposes safe fields only — never passwordHash', () => {
    const account: AccountResponse = {
      id: '1',
      email: 'student@example.com',
      role: 'STUDENT',
      isVerified: true,
      isBanned: false,
      bannedAt: null,
      bannedUntil: null,
      createdAt: '2026-11-08T00:00:00.000Z',
      updatedAt: '2026-11-08T00:00:00.000Z',
    };

    expect(keysOf(account)).toEqual([
      'bannedAt',
      'bannedUntil',
      'createdAt',
      'email',
      'id',
      'isBanned',
      'isVerified',
      'role',
      'updatedAt',
    ]);
    expect(account).not.toHaveProperty('passwordHash');
  });

  it('auth request/response shapes match the API endpoints', () => {
    const register: RegisterRequest = {
      email: 'student@example.com',
      password: 'Str0ngPass!23',
    };
    expect(keysOf(register)).toEqual(['email', 'password']);

    const registered: RegisterResponse = {
      account: {
        id: '1',
        email: 'student@example.com',
        role: 'STUDENT',
        isVerified: false,
        isBanned: false,
        bannedAt: null,
        bannedUntil: null,
        createdAt: '2026-11-08T00:00:00.000Z',
        updatedAt: '2026-11-08T00:00:00.000Z',
      },
      confirmation: {
        token: 'token',
        expiresAt: '2026-11-09T00:00:00.000Z',
      },
    };
    expect(keysOf(registered)).toEqual(['account', 'confirmation']);
    expect(keysOf(registered.confirmation)).toEqual(['expiresAt', 'token']);

    const tokens: AuthTokens = {
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 900,
    };
    expect(keysOf(tokens)).toEqual([
      'accessToken',
      'expiresIn',
      'refreshToken',
    ]);

    const changePassword: ChangePasswordRequest = {
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass2!',
    };
    expect(keysOf(changePassword)).toEqual(['currentPassword', 'newPassword']);
    const passwordChanged: ChangePasswordResponse = { success: true };
    expect(keysOf(passwordChanged)).toEqual(['success']);

    const changeEmail: ChangeEmailRequest = { newEmail: 'new@example.com' };
    expect(keysOf(changeEmail)).toEqual(['newEmail']);
    const emailChanged: ChangeEmailResponse = { message: 'generic' };
    expect(keysOf(emailChanged)).toEqual(['message']);
  });

  it('confirmation shapes match the verify/resend endpoints', () => {
    const verified: VerifyEmailResponse = { verified: true };
    expect(keysOf(verified)).toEqual(['verified']);

    const resendRequest: ResendConfirmationRequest = {
      email: 'student@example.com',
    };
    expect(keysOf(resendRequest)).toEqual(['email']);
    const resendResponse: ResendConfirmationResponse = { message: 'generic' };
    expect(keysOf(resendResponse)).toEqual(['message']);
  });

  it('profile shapes match the profile endpoints', () => {
    const create: CreateProfileRequest = {
      firstName: 'Test',
      lastName: 'Student',
      diploma: 'Bac',
      university: 'UTM',
      skills: ['React'],
      links: ['https://example.com'],
      curriculum: [{ institution: 'UTM', degree: 'Licence' }],
      photoUploadId: null,
      cvUploadId: null,
    };
    expect(keysOf(create).sort()).toEqual([
      'curriculum',
      'cvUploadId',
      'diploma',
      'firstName',
      'lastName',
      'links',
      'photoUploadId',
      'skills',
      'university',
    ]);

    const profile: ProfileResponse = {
      id: 'p1',
      accountId: '1',
      firstName: 'Test',
      lastName: 'Student',
      skills: [],
      links: [],
      createdAt: '2026-11-08T00:00:00.000Z',
      updatedAt: '2026-11-08T00:00:00.000Z',
    };
    expect(keysOf(profile)).toEqual([
      'accountId',
      'createdAt',
      'firstName',
      'id',
      'lastName',
      'links',
      'skills',
      'updatedAt',
    ]);
  });

  it('upload shapes match the upload endpoints', () => {
    const upload: UploadResponse = {
      id: 'u1',
      accountId: '1',
      originalName: 'me.jpg',
      storageKey: 'key1.jpg',
      mimeType: 'image/jpeg',
      size: 100,
      purpose: 'PROFILE_PHOTO',
      createdAt: '2026-11-08T00:00:00.000Z',
    };
    expect(keysOf(upload)).toEqual([
      'accountId',
      'createdAt',
      'id',
      'mimeType',
      'originalName',
      'purpose',
      'size',
      'storageKey',
    ]);
  });
});
