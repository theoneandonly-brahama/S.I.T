// Layer 2 integration test for the upload pipeline against a real
// PostgreSQL container. Verifies the HTTP surface: multipart intake,
// MIME allowlist rejection, signed access, ownership enforcement and
// deletion (disk + database).

import 'reflect-metadata';
import '../../vitest.setup'; // Testcontainers + Prisma setup
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module.js';
import { configureApp } from '../common/configure-app.js';
import { PROFILE_PHOTO_MAX_SIZE } from './upload.constants.js';

describe('Upload endpoints (integration, real PostgreSQL + disk)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const unique = Date.now().toString(36);
  const ownerEmail = `uploader_${unique}@sit.test`;
  const intruderEmail = `intruder_${unique}@sit.test`;
  const password = 'Str0ngPass!';

  let ownerToken = '';
  let intruderToken = '';
  let profilePhotoKey = '';
  let profileCvKey = '';

  // Minimal PNG payload — the service validates the declared MIME type,
  // not the file content.
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

  /**
   * Registers an account, confirms it, and returns a login access token.
   * Registration no longer issues a session, so every authenticated
   * fixture must pass through the confirmation endpoint first.
   */
  async function registerAndLogin(email: string): Promise<string> {
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

    return login.body.accessToken;
  }

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

    ownerToken = await registerAndLogin(ownerEmail);
    intruderToken = await registerAndLogin(intruderEmail);
  });

  afterAll(async () => {
    if (server && ownerToken) {
      for (const key of [profilePhotoKey, profileCvKey]) {
        if (key) {
          await request(server)
            .delete(`/upload/${key}`)
            .set('Authorization', `Bearer ${ownerToken}`);
        }
      }
    }
    await app.close();
  });

  it('POST /upload requires authentication', async () => {
    await request(server).post('/upload').expect(401);
  });

  it('POST /upload without a file returns 400', async () => {
    const res = await request(server)
      .post('/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
    expect(res.body.message).toBe('No file uploaded.');
  });

  it('POST /upload rejects a disallowed MIME type with 400', async () => {
    const res = await request(server)
      .post('/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', Buffer.from('console.log(1);'), {
        filename: 'script.js',
        contentType: 'text/plain',
      })
      .expect(400);
    expect(res.body.message).toContain('not allowed');
  });

  let storageKey = '';

  it('POST /upload stores a PNG and returns safe metadata', async () => {
    const res = await request(server)
      .post('/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', png, { filename: 'photo.png', contentType: 'image/png' })
      .expect(201);

    expect(res.body.mimeType).toBe('image/png');
    expect(res.body.size).toBe(png.length);
    expect(res.body.originalName).toBe('photo.png');
    expect(res.body.purpose).toBe('GENERAL');
    expect(res.body.storageKey).toMatch(/^[a-f0-9]+\.png$/);
    expect(res.body).not.toHaveProperty('path');

    storageKey = res.body.storageKey;
  });

  it('GET /upload lists only the owned uploads', async () => {
    const res = await request(server)
      .get('/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].storageKey).toBe(storageKey);

    const intruderList = await request(server)
      .get('/upload')
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(200);
    expect(intruderList.body).toHaveLength(0);
  });

  it('GET /upload/:key/signed-access returns a time-limited token', async () => {
    const res = await request(server)
      .get(`/upload/${storageKey}/signed-access`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('GET /upload/:key/signed-access denies non-owners with 401', async () => {
    const res = await request(server)
      .get(`/upload/${storageKey}/signed-access`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(401);
    expect(res.body.statusCode).toBe(401);
  });

  it('GET /upload/:key/signed-access returns 404 for an unknown key', async () => {
    await request(server)
      .get(`/upload/${'a'.repeat(32)}.png/signed-access`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });

  it("DELETE /upload/:key refuses to delete another account's file", async () => {
    await request(server)
      .delete(`/upload/${storageKey}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(401);
  });

  it('DELETE /upload/:key removes the record for the owner', async () => {
    await request(server)
      .delete(`/upload/${storageKey}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    // The record is gone: list is empty and signed access 404s.
    const list = await request(server)
      .get('/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body).toHaveLength(0);

    await request(server)
      .get(`/upload/${storageKey}/signed-access`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });

  it('POST /upload with purpose=PROFILE_PHOTO stores the slot', async () => {
    const res = await request(server)
      .post('/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('purpose', 'PROFILE_PHOTO')
      .attach('file', png, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(201);

    expect(res.body.purpose).toBe('PROFILE_PHOTO');
    expect(res.body.storageKey).toMatch(/^[a-f0-9]+\.png$/);
    profilePhotoKey = res.body.storageKey;
  });

  it('POST /upload with purpose=PROFILE_PHOTO rejects an image above 2 MB', async () => {
    const res = await request(server)
      .post('/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('purpose', 'PROFILE_PHOTO')
      .attach('file', Buffer.alloc(PROFILE_PHOTO_MAX_SIZE + 1), {
        filename: 'too-big.png',
        contentType: 'image/png',
      })
      .expect(400);

    expect(res.body.message).toContain('too large');
  });

  it('POST /upload with purpose=PROFILE_PHOTO rejects a PDF', async () => {
    const res = await request(server)
      .post('/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('purpose', 'PROFILE_PHOTO')
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'not-a-photo.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    expect(res.body.message).toContain('not allowed');
  });

  it('POST /upload with purpose=PROFILE_CV stores the slot', async () => {
    const res = await request(server)
      .post('/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('purpose', 'PROFILE_CV')
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'cv.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(res.body.purpose).toBe('PROFILE_CV');
    expect(res.body.storageKey).toMatch(/^[a-f0-9]+\.pdf$/);
    profileCvKey = res.body.storageKey;
  });

  it('POST /upload with purpose=PROFILE_CV rejects a PNG', async () => {
    const res = await request(server)
      .post('/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('purpose', 'PROFILE_CV')
      .attach('file', png, { filename: 'cv.png', contentType: 'image/png' })
      .expect(400);

    expect(res.body.message).toContain('not allowed');
  });

  it('POST /upload rejects content whose magic bytes do not match the declared type', async () => {
    // Declared as a profile photo (image/png) but the bytes are a PDF:
    // the declared type passes the allowlist, the magic bytes do not.
    const res = await request(server)
      .post('/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('purpose', 'PROFILE_PHOTO')
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'disguised.png',
        contentType: 'image/png',
      })
      .expect(400);

    expect(res.body.message).toContain('does not match');
  });

  it('POST /upload rejects an unknown purpose with 400', async () => {
    await request(server)
      .post('/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('purpose', 'NOT_A_PURPOSE')
      .attach('file', png, { filename: 'photo.png', contentType: 'image/png' })
      .expect(400);
  });
});
