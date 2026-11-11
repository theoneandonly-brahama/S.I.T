// Layer 2 integration test: full HTTP journey against a real PostgreSQL
// container (Testcontainers) with all migrations applied.
//
// Boots the actual Nest application (same configureApp wiring as
// production) and exercises every Sprint 2 endpoint through HTTP with
// supertest, so controller routing, guards, DTO validation, the
// exception filter, service logic and database constraints are all
// verified together.

import 'reflect-metadata';
import './vitest.setup.js'; // Testcontainers + Prisma setup
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module.js';
import { configureApp } from './common/configure-app.js';
import { ConfirmationDeliveryService } from './confirmation-token/confirmation-delivery.service.js';

describe('S.I.T API (integration, real PostgreSQL)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const unique = Date.now().toString(36);
  const email = `student_${unique}@sit.test`;
  const password = 'Str0ngPass!';
  const ghostEmail = `ghost_${unique}@sit.test`;

  let accessToken = '';
  let refreshToken = '';
  let confirmationToken = '';

  beforeAll(async () => {
    // Wait for DATABASE_URL to be set by the Vitest workspace setupFiles
    // (vitest.setup.ts spins up PostgreSQL via Testcontainers and sets DATABASE_URL;
    // a short retry ensures the env var propagates before Nest bootstraps)
    let retries = 0;
    while (!process.env.DATABASE_URL && retries < 20) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      retries++;
    }
    app = await NestFactory.create(AppModule, {
      logger: false,
      abortOnError: false,
    });
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app?.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Registers an account, confirms it through the public token endpoint,
   * and logs in. Used by tests that need an authenticated account without
   * asserting the registration flow itself.
   */
  async function registerAndVerify(email: string, password: string) {
    const registration = await request(server)
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    await request(server)
      .get('/confirmation-token/verify')
      .query({ token: registration.body.confirmation.token })
      .expect(200);

    const login = await request(server)
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    return { registration, login };
  }

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------
  it('GET /health returns service status', async () => {
    const res = await request(server).get('/health').expect(200);
    expect(res.body.status).toBe('healthy');
    expect(typeof res.body.timestamp).toBe('string');
  });

  // -------------------------------------------------------------------------
  // Registration (incl. validation and privilege-escalation guard)
  // -------------------------------------------------------------------------
  it('POST /auth/register rejects an invalid email with 400', async () => {
    const res = await request(server)
      .post('/auth/register')
      .send({ email: 'not-an-email', password })
      .expect(400);
    expect(res.body.statusCode).toBe(400);
  });

  it('POST /auth/register rejects a client-supplied role with 400', async () => {
    // The role field does not exist on RegisterDto — accepting it would
    // allow privilege escalation (registering as PLATFORM_STAFF).
    const res = await request(server)
      .post('/auth/register')
      .send({
        email: `escalate_${unique}@sit.test`,
        password,
        role: 'PLATFORM_STAFF',
      })
      .expect(400);
    expect(res.body.statusCode).toBe(400);
  });

  it('POST /auth/register creates an inactive STUDENT account and a confirmation token', async () => {
    const res = await request(server)
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    expect(res.body.account.email).toBe(email);
    expect(res.body.account.role).toBe('STUDENT');
    expect(res.body.account.isVerified).toBe(false);
    expect(res.body.account).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('accessToken');
    expect(res.body).not.toHaveProperty('refreshToken');
    expect(typeof res.body.confirmation.token).toBe('string');
    expect(typeof res.body.confirmation.expiresAt).toBe('string');

    confirmationToken = res.body.confirmation.token;
  });

  it('POST /auth/register always returns 201 with { account, confirmation } (anti-enumeration)', async () => {
    // First registration with a new email
    await request(server)
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    // Second registration with the same email — must not return 409.
    // The response must be identical in shape and status, preserving
    // the anti-enumeration property: an attacker cannot tell whether
    // the address already exists.
    const secondRes = await request(server)
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    expect(secondRes.body.account.email).toBe(email);
    expect(typeof secondRes.body.confirmation.token).toBe('string');
    // expiresAt is returned as ISO string from the API
    expect(secondRes.body.confirmation.expiresAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    );

    // Each registration upserts a fresh confirmation token, invalidating
    // the previous one. The shared token must track the latest valid
    // one so downstream tests verify with the token that is actually
    // stored (a real user uses the newest link in the latest email).
    confirmationToken = secondRes.body.confirmation.token;
  });

  // -------------------------------------------------------------------------
  // Login (uniform failure, including unverified accounts)
  // -------------------------------------------------------------------------
  it('POST /auth/login refuses an unverified account with the uniform 401', async () => {
    const res = await request(server)
      .post('/auth/login')
      .send({ email, password })
      .expect(401);
    expect(res.body.message).toBe('Invalid credentials.');
  });

  it('GET /confirmation-token/verify activates the registered account', async () => {
    const res = await request(server)
      .get('/confirmation-token/verify')
      .query({ token: confirmationToken })
      .expect(200);
    expect(res.body.verified).toBe(true);
  });

  it('POST /auth/login succeeds after email confirmation', async () => {
    const res = await request(server)
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('POST /auth/login returns 401 with a uniform message for a wrong password', async () => {
    const res = await request(server)
      .post('/auth/login')
      .send({ email, password: 'WrongPass9!' })
      .expect(401);
    expect(res.body.message).toBe('Invalid credentials.');
  });

  it('POST /auth/login returns the identical 401 message for an unknown account', async () => {
    const res = await request(server)
      .post('/auth/login')
      .send({ email: ghostEmail, password: 'WrongPass9!' })
      .expect(401);
    expect(res.body.message).toBe('Invalid credentials.');
  });

  // -------------------------------------------------------------------------
  // Protected account endpoints (JWT guard + credential stripping)
  // -------------------------------------------------------------------------
  it('GET /accounts/me rejects requests without a token with 401', async () => {
    const res = await request(server).get('/accounts/me').expect(401);
    expect(res.body.statusCode).toBe(401);
  });

  it('GET /accounts/me returns the account without passwordHash', async () => {
    const res = await request(server)
      .get('/accounts/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.email).toBe(email);
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('PATCH /accounts/me rejects email changes (must use /auth/change-email)', async () => {
    // Email is deliberately not a patchable field: changing it here
    // would bypass re-verification (isVerified reset + confirmation
    // token). The global ValidationPipe forbids unknown properties.
    await request(server)
      .patch('/accounts/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: `renamed_${unique}@sit.test` })
      .expect(400);

    // The stored email is untouched.
    const me = await request(server)
      .get('/accounts/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.email).toBe(email);
  });

  it('PATCH /accounts/me with no fields returns the account unchanged', async () => {
    const res = await request(server)
      .patch('/accounts/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(200);
    expect(res.body.email).toBe(email);
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  // -------------------------------------------------------------------------
  // Email confirmation (single-use, 24h tokens)
  // -------------------------------------------------------------------------
  it('POST /confirmation-token requires authentication', async () => {
    await request(server).post('/confirmation-token').send({}).expect(401);
  });

  it('POST /confirmation-token issues a token for the account', async () => {
    const res = await request(server)
      .post('/confirmation-token')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(201);
    expect(typeof res.body.token).toBe('string');
    expect(typeof res.body.expiresAt).toBe('string');
    confirmationToken = res.body.token;
  });

  it('GET /confirmation-token/verify marks the account verified', async () => {
    const res = await request(server)
      .get('/confirmation-token/verify')
      .query({ token: confirmationToken })
      .expect(200);
    expect(res.body.verified).toBe(true);

    const me = await request(server)
      .get('/accounts/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.isVerified).toBe(true);
  });

  it('GET /confirmation-token/verify rejects reuse of a consumed token', async () => {
    const res = await request(server)
      .get('/confirmation-token/verify')
      .query({ token: confirmationToken })
      .expect(401);
    expect(res.body.statusCode).toBe(401);
  });

  it('GET /confirmation-token/verify rejects an unknown token with 401', async () => {
    await request(server)
      .get('/confirmation-token/verify')
      .query({ token: 'deadbeef'.repeat(8) })
      .expect(401);
  });

  it('GET /confirmation-token/verify without a token param returns 400', async () => {
    await request(server).get('/confirmation-token/verify').expect(400);
  });

  // -------------------------------------------------------------------------
  // Public resend (anti-enumeration, delivery seam)
  // -------------------------------------------------------------------------
  it('POST /confirmation-token/resend delivers a fresh token for an unverified account', async () => {
    const resendEmail = `resend_${unique}@sit.test`;

    await request(server)
      .post('/auth/register')
      .send({ email: resendEmail, password })
      .expect(201);

    const delivery = app.get(ConfirmationDeliveryService);
    const delivered: Array<{ email: string; token: string }> = [];
    vi.spyOn(delivery, 'deliver').mockImplementation(async (target, token) => {
      delivered.push({ email: target, token });
    });

    const res = await request(server)
      .post('/confirmation-token/resend')
      .send({ email: resendEmail })
      .expect(200);

    expect(res.body.message).toMatch(/If an unverified account exists/);
    expect(delivered).toHaveLength(1);
    expect(delivered[0].email).toBe(resendEmail);
    expect(typeof delivered[0].token).toBe('string');

    await request(server)
      .get('/confirmation-token/verify')
      .query({ token: delivered[0].token })
      .expect(200);

    const login = await request(server)
      .post('/auth/login')
      .send({ email: resendEmail, password })
      .expect(200);
    expect(typeof login.body.accessToken).toBe('string');
  });

  it('POST /confirmation-token/resend returns the same generic message for unknown or verified addresses', async () => {
    const delivery = app.get(ConfirmationDeliveryService);
    const deliver = vi
      .spyOn(delivery, 'deliver')
      .mockImplementation(async () => undefined);

    const unknown = await request(server)
      .post('/confirmation-token/resend')
      .send({ email: `missing_${unique}@sit.test` })
      .expect(200);
    expect(unknown.body.message).toBe(
      'If an unverified account exists for this address, a confirmation token has been issued.'
    );

    const verified = await request(server)
      .post('/confirmation-token/resend')
      .send({ email })
      .expect(200);
    expect(verified.body.message).toBe(unknown.body.message);
    expect(deliver).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Profile (ownership + one-per-account + patch semantics)
  // -------------------------------------------------------------------------
  it('POST /profile validates required fields', async () => {
    await request(server)
      .post('/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ lastName: 'Only' })
      .expect(400);
  });

  it('POST /profile creates the profile for the account', async () => {
    const res = await request(server)
      .post('/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'Test', lastName: 'Student' })
      .expect(201);
    expect(res.body.firstName).toBe('Test');
    expect(res.body.accountId).toBeDefined();
  });

  it('POST /profile rejects a duplicate profile with 409', async () => {
    await request(server)
      .post('/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'Dup', lastName: 'Profile' })
      .expect(409);
  });

  it('GET /profile returns the owned profile', async () => {
    const res = await request(server)
      .get('/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.firstName).toBe('Test');
  });

  it('PATCH /profile applies patch semantics (unchanged fields stay)', async () => {
    const res = await request(server)
      .patch('/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ diploma: 'BAC Science' })
      .expect(200);
    expect(res.body.diploma).toBe('BAC Science');
    expect(res.body.firstName).toBe('Test');
  });

  it('PATCH /profile rejects unknown properties with 400', async () => {
    await request(server)
      .patch('/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ isAdmin: true })
      .expect(400);
  });

  it("GET /profile enforces ownership (404 for another account's view)", async () => {
    const other = await registerAndVerify(`other_${unique}@sit.test`, password);

    await request(server)
      .get('/profile')
      .set('Authorization', `Bearer ${other.login.body.accessToken}`)
      .expect(404);
  });

  // -------------------------------------------------------------------------
  // Refresh token rotation and logout
  // -------------------------------------------------------------------------
  it('POST /auth/refresh rejects a garbage token with 401', async () => {
    await request(server)
      .post('/auth/refresh')
      .send({ refreshToken: 'not-a-jwt' })
      .expect(401);
  });

  it('POST /auth/refresh rotates the refresh token', async () => {
    // Capture the token BEFORE rotating so its reuse can be asserted safely.
    const preRotationRefreshToken = refreshToken;

    const first = await request(server)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect(typeof first.body.refreshToken).toBe('string');
    // Rotate: the service revokes the pre-rotation session on rotation.
    refreshToken = first.body.refreshToken;

    // Replaying the pre-rotation token must fail: rotation revokes it.
    await request(server)
      .post('/auth/refresh')
      .send({ refreshToken: preRotationRefreshToken })
      .expect(401);

    // The rotated token works.
    const second = await request(server)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    accessToken = second.body.accessToken;
  });

  it('POST /auth/logout revokes the session (204, idempotent)', async () => {
    await request(server)
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(204);

    // The revoked refresh token can no longer be used.
    await request(server)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    // Logging out again with the same token stays idempotent.
    await request(server)
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(204);
  });

  // -------------------------------------------------------------------------
  // Sessions (list, revoke one, revoke all)
  // -------------------------------------------------------------------------
  it('GET /sessions lists active sessions without token hashes', async () => {
    // A fresh login guarantees at least one active session.
    const login = await request(server)
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    accessToken = login.body.accessToken;

    const res = await request(server)
      .get('/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    for (const session of res.body) {
      expect(session).not.toHaveProperty('refreshTokenHash');
    }

    // Revoking one session returns a safe shape; re-revoking is a 404.
    const target = res.body[0];
    const revoked = await request(server)
      .delete(`/sessions/${target.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(revoked.body.id).toBe(target.id);
    expect(revoked.body).toHaveProperty('revokedAt');
    expect(revoked.body).not.toHaveProperty('refreshTokenHash');

    await request(server)
      .delete(`/sessions/${target.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('DELETE /sessions revokes every session (refresh then fails)', async () => {
    const login = await request(server)
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const freshRefresh = login.body.refreshToken;
    accessToken = login.body.accessToken;

    const res = await request(server)
      .delete('/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);

    // Every refresh token is now revoked.
    await request(server)
      .post('/auth/refresh')
      .send({ refreshToken: freshRefresh })
      .expect(401);
  });

  it('POST /auth/change-password changes the password for the authenticated account', async () => {
    // Isolated account so the shared password used by later logins in
    // this suite is not mutated.
    const cpEmail = `changepw_${unique}@sit.test`;
    const { login } = await registerAndVerify(cpEmail, password);
    const token = login.body.accessToken;

    // Unauthenticated requests are rejected.
    await request(server)
      .post('/auth/change-password')
      .send({ currentPassword: password, newPassword: 'N3wPassword!' })
      .expect(401);

    // Wrong current password → uniform 401, password unchanged.
    await request(server)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPass9!', newPassword: 'N3wPassword!' })
      .expect(401);

    const res = await request(server)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password, newPassword: 'N3wPassword!' })
      .expect(200);
    expect(res.body).toEqual({ success: true });

    // Old password no longer logs in; new password does.
    await request(server)
      .post('/auth/login')
      .send({ email: cpEmail, password })
      .expect(401);
    const relogin = await request(server)
      .post('/auth/login')
      .send({ email: cpEmail, password: 'N3wPassword!' })
      .expect(200);
    expect(typeof relogin.body.accessToken).toBe('string');
  });

  it('POST /auth/change-email updates the email and delivers the token to the new address', async () => {
    // Isolated account so the shared email/password are not mutated.
    const ceEmail = `changeemail_${unique}@sit.test`;
    const newEmail = `changeemail_new_${unique}@sit.test`;
    const { login } = await registerAndVerify(ceEmail, password);
    const token = login.body.accessToken;

    const delivery = app.get(ConfirmationDeliveryService);
    const delivered: Array<{ email: string; token: string }> = [];
    vi.spyOn(delivery, 'deliver').mockImplementation(
      async (email: string, tok: string) => {
        delivered.push({ email, token: tok });
      }
    );

    // Unauthenticated requests are rejected.
    await request(server)
      .post('/auth/change-email')
      .send({ newEmail })
      .expect(401);

    const res = await request(server)
      .post('/auth/change-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ newEmail })
      .expect(200);
    expect(res.body.message).toMatch(/If an unverified account exists/);

    // The re-verification token goes to the NEW inbox (industry standard).
    expect(delivered).toHaveLength(1);
    expect(delivered[0].email).toBe(newEmail);

    // The delivered token verifies against the account.
    await request(server)
      .get('/confirmation-token/verify')
      .query({ token: delivered[0].token })
      .expect(200);

    // Login now works under the new email address.
    const relogin = await request(server)
      .post('/auth/login')
      .send({ email: newEmail, password })
      .expect(200);
    expect(typeof relogin.body.accessToken).toBe('string');
  });

  it('POST /auth/change-email resets verification until the new address is confirmed', async () => {
    const reEmail = `changeemail_re_${unique}@sit.test`;
    const reNewEmail = `changeemail_re_new_${unique}@sit.test`;
    const { login } = await registerAndVerify(reEmail, password);
    const token = login.body.accessToken;
    const oldRefresh = login.body.refreshToken;

    const delivery = app.get(ConfirmationDeliveryService);
    const delivered: Array<{ email: string; token: string }> = [];
    vi.spyOn(delivery, 'deliver').mockImplementation(
      async (email: string, tok: string) => {
        delivered.push({ email, token: tok });
      }
    );

    await request(server)
      .post('/auth/change-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ newEmail: reNewEmail })
      .expect(200);

    // isVerified reset: login under the new email is refused (uniform 401)
    // until the confirmation token is clicked.
    await request(server)
      .post('/auth/login')
      .send({ email: reNewEmail, password })
      .expect(401);

    // Sessions issued under the old address are revoked: the old
    // refresh token cannot rotate (uniform 401).
    await request(server)
      .post('/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(401);

    await request(server)
      .get('/confirmation-token/verify')
      .query({ token: delivered[0].token })
      .expect(200);

    const relogin = await request(server)
      .post('/auth/login')
      .send({ email: reNewEmail, password })
      .expect(200);
    expect(typeof relogin.body.accessToken).toBe('string');
  });
});
