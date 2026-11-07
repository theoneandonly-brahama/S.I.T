import { describe, it, expect } from 'vitest';
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes a valid password', async () => {
    const hash = await service.hash('Str0ngP@ss');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('rejects password shorter than 8 characters', async () => {
    await expect(service.hash('Short1')).rejects.toThrow(
      'at least 8 characters'
    );
  });

  it('rejects password longer than 128 characters', async () => {
    const tooLong = 'A'.repeat(100) + 'b'.repeat(30); // 130 chars
    await expect(service.hash(tooLong)).rejects.toThrow('128 characters');
  });

  it('rejects password without a letter', async () => {
    await expect(service.hash('12345678')).rejects.toThrow('one letter');
  });

  it('rejects password without a digit', async () => {
    await expect(service.hash('Password')).rejects.toThrow('one digit');
  });

  it('verifies a matching password', async () => {
    const hash = await service.hash('Str0ngP@ss');
    expect(await service.verify('Str0ngP@ss', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash('Str0ngP@ss');
    expect(await service.verify('WrongP@ss1', hash)).toBe(false);
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    expect(await service.verify('anything', 'not-a-valid-hash')).toBe(false);
  });
});
