import { describe, it, expect } from 'vitest';
import type { Credentials, SessionToken, Student } from './index.js';

describe('@sit/contract', () => {
  it('describes the shared contract types', () => {
    const student: Student = {
      id: 's-1',
      email: 'student@example.com',
      address: '',
      confirmed: false,
    };
    const credentials: Credentials = { password: 'hashed-value' };
    const token: SessionToken = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    };

    expect(student.id).toBe('s-1');
    expect(credentials.password).toBe('hashed-value');
    expect(token.accessToken).toBe('access-token');
  });
});
