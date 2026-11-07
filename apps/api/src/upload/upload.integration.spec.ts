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

describe('Upload endpoints (integration, real PostgreSQL + disk)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const unique = Date.now().toString(36);
  const ownerEmail = `uploader_${unique}@sit.test`;
  const intruderEmail = `intruder_${unique}@sit.test`;
  const password = 'Str0ngPass!';

  let ownerToken = '';
  let intruderToken = '';

  // Minimal PNG payload — the service validates the declared MIME type,
  // not the file content.
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

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

    const owner = await request(server)
      .post('/auth/register')
      .send({ email: ownerEmail, password })
      .expect(201);
    ownerToken = owner.body.accessToken;

    const intruder = await request(server)
      .post('/auth/register')
      .send({ email: intruderEmail, password })
      .expect(201);
    intruderToken = intruder.body.accessToken;
  });

  afterAll(async () => {
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
});
