import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProfileDto, UpdateProfileDto } from './profile.dto.js';

async function validatePayload<T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>
) {
  const instance = plainToInstance(cls, payload);
  return validate(instance as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('CreateProfileDto', () => {
  it('accepts a minimal profile', async () => {
    const errors = await validatePayload(CreateProfileDto, {
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts skills, http(s) links, curriculum and a UUID photo id', async () => {
    const errors = await validatePayload(CreateProfileDto, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      skills: ['TypeScript', 'NestJS'],
      links: ['https://example.com', 'http://localhost:3000'],
      curriculum: [
        {
          institution: 'MIT',
          degree: 'BSc',
          startYear: 2018,
          endYear: 2021,
        },
      ],
      photoUploadId: '00000000-0000-4000-8000-000000000000',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a javascript: link', async () => {
    const errors = await validatePayload(CreateProfileDto, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      links: ['javascript:alert(1)'],
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-UUID photoUploadId', async () => {
    const errors = await validatePayload(CreateProfileDto, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      photoUploadId: 'not-a-uuid',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects more than 50 skills', async () => {
    const errors = await validatePayload(CreateProfileDto, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      skills: Array.from({ length: 51 }, (_, index) => `skill-${index}`),
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-integer curriculum year', async () => {
    const errors = await validatePayload(CreateProfileDto, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      curriculum: [{ institution: 'MIT', degree: 'BSc', startYear: 2018.5 }],
    });

    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('UpdateProfileDto', () => {
  it('accepts a null photoUploadId to detach the slot', async () => {
    const errors = await validatePayload(UpdateProfileDto, {
      photoUploadId: null,
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a non-URL link', async () => {
    const errors = await validatePayload(UpdateProfileDto, {
      links: ['not a url'],
    });

    expect(errors.length).toBeGreaterThan(0);
  });
});
