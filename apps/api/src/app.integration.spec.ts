// Layer 2 integration test: full HTTP journey against a real PostgreSQL
// container (Testcontainers) with all migrations applied.
//
// Boots the actual Nest application (same configureApp wiring as
// production) and exercises every Sprint 2 endpoint through HTTP with
// supertest, so controller routing, guards, DTO validation, the
// exception filter, service logic and database constraints are all
// verified together.

import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module.js';
import { configureApp } from './common/configure-app.js';

describe('S.I.T API (integration, real PostgreSQL)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const unique = Date.now().toString(36);
  const email = `student_${unique}@sit.test`;
  const password = 'Str0ngPass!';
  const ghostEmail = `ghost_${unique}@sit.test`;

  let accessToken = '';
  let refreshToken = '';

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, {
      logger: false,
      // Re-throws initialization errors instead of calling
      // process.abort(), so a boot failure surfaces as a normal test
      // failure with the real message rather than a worker crash.
      abortOnError: false,
    });
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

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

  it('POST /auth/register creates a STUDENT account and returns tokens', async () => {
    const res = await request(server)
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    expect(res.body.account.email).toBe(email);
    expect(res.body.account.role).toBe('STUDENT');
    expect(res.body.account.isVerified).toBe(false);
    expect(res.body.account).not.toHaveProperty('passwordHash');
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(typeof res.body.expiresIn).toBe('number');

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('POST /auth/register rejects a duplicate email with 409', async () => {
    const res = await request(server)
      .post('/auth/register')
      .send({ email, password })
      .expect(409);
    expect(res.body.statusCode).toBe(409);
  });

  // -------------------------------------------------------------------------
  // Login (uniform failure)
  // -------------------------------------------------------------------------
  it('POST /auth/login succeeds with correct credentials', async () => {
    const res = await request(server)
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
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

  it('PATCH /accounts/me updates email without leaking credentials', async () => {
    const newEmail = `renamed_${unique}@sit.test`;
    const res = await request(server)
      .patch('/accounts/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: newEmail })
      .expect(200);
    expect(res.body.email).toBe(newEmail);
    expect(res.body).not.toHaveProperty('passwordHash');

    // Restore so later login tests keep working.
    const back = await request(server)
      .patch('/accounts/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email })
      .expect(200);
    expect(back.body.email).toBe(email);
  });

  it('PATCH /accounts/me rejects an invalid email with 400', async () => {
    await request(server)
      .patch('/accounts/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: 'nope' })
      .expect(400);
  });

  // -------------------------------------------------------------------------
  // Email confirmation (single-use, 24h tokens)
  // -------------------------------------------------------------------------
  it('POST /confirmation-token requires authentication', async () => {
    await request(server).post('/confirmation-token').send({}).expect(401);
  });

  let confirmationToken = '';

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
    const other = await request(server)
      .post('/auth/register')
      .send({ email: `other_${unique}@sit.test`, password })
      .expect(201);

    await request(server)
      .get('/profile')
      .set('Authorization', `Bearer ${other.body.accessToken}`)
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
    const first = await request(server)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect(typeof first.body.refreshToken).toBe('string');

    // The original token is revoked after rotation.
    await request(server)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    // The rotated token works.
    const second = await request(server)
      .post('/auth/refresh')
      .send({ refreshToken: first.body.refreshToken })
      .expect(200);

    refreshToken = second.body.refreshToken;
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
});
