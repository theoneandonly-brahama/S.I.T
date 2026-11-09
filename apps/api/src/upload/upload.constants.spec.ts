import { describe, it, expect } from 'vitest';
import { matchesMimeMagic } from './upload.constants.js';

describe('matchesMimeMagic', () => {
  it('accepts a JPEG buffer', () => {
    expect(
      matchesMimeMagic(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg')
    ).toBe(true);
  });

  it('rejects a PNG buffer declared as JPEG', () => {
    expect(
      matchesMimeMagic(
        Buffer.from('89504e470d0a1a0a', 'hex'),
        'image/jpeg'
      )
    ).toBe(false);
  });

  it('accepts a PNG buffer', () => {
    expect(
      matchesMimeMagic(Buffer.from('89504e470d0a1a0a', 'hex'), 'image/png')
    ).toBe(true);
  });

  it('rejects a truncated PNG signature', () => {
    expect(matchesMimeMagic(Buffer.from([0x89, 0x50]), 'image/png')).toBe(
      false
    );
  });

  it('accepts GIF87a and GIF89a buffers', () => {
    expect(matchesMimeMagic(Buffer.from('GIF87a'), 'image/gif')).toBe(true);
    expect(matchesMimeMagic(Buffer.from('GIF89a'), 'image/gif')).toBe(true);
  });

  it('rejects a non-GIF buffer declared as GIF', () => {
    expect(matchesMimeMagic(Buffer.from('%PDF'), 'image/gif')).toBe(false);
  });

  it('accepts a WEBP buffer (RIFF + WEBP at offset 8)', () => {
    const webp = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x10, 0x00, 0x00, 0x00]),
      Buffer.from('WEBP'),
    ]);
    expect(matchesMimeMagic(webp, 'image/webp')).toBe(true);
  });

  it('rejects a RIFF buffer without the WEBP chunk', () => {
    const wave = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x10, 0x00, 0x00, 0x00]),
      Buffer.from('WAVE'),
    ]);
    expect(matchesMimeMagic(wave, 'image/webp')).toBe(false);
  });

  it('rejects WEBP buffers wrong at exactly one byte position', () => {
    // Each buffer is a valid WEBP except for a single mutated byte, so
    // every conjunct of the RIFF/WEBP check is pinned individually.
    const valid = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x10, 0x00, 0x00, 0x00]),
      Buffer.from('WEBP'),
    ]);
    for (const [index, byte] of [
      [0, 0x58], // 'X' instead of 'R'
      [8, 0x58], // 'W' broken
      [9, 0x58], // 'E' broken
      [10, 0x58], // 'B' broken
      [11, 0x58], // 'P' broken
    ] as const) {
      const mutated = Buffer.from(valid);
      mutated[index] = byte;
      expect(matchesMimeMagic(mutated, 'image/webp')).toBe(false);
    }
  });

  it('rejects a short RIFF buffer without room for the WEBP chunk', () => {
    expect(
      matchesMimeMagic(Buffer.from('RIFFWEBP'), 'image/webp')
    ).toBe(false);
  });

  it('accepts a PDF buffer', () => {
    expect(matchesMimeMagic(Buffer.from('%PDF-1.4'), 'application/pdf')).toBe(
      true
    );
  });

  it('rejects an empty buffer for every supported type', () => {
    for (const mime of [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ]) {
      expect(matchesMimeMagic(Buffer.alloc(0), mime)).toBe(false);
    }
  });

  it('returns false for unsupported MIME types', () => {
    expect(matchesMimeMagic(Buffer.from('%PDF'), 'text/plain')).toBe(false);
    expect(matchesMimeMagic(Buffer.from('GIF89a'), 'image/svg+xml')).toBe(
      false
    );
  });
});
